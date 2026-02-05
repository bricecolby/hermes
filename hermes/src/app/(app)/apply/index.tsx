import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  UIManager,
} from "react-native";
import { Stack } from "expo-router";
import { Text, XStack, YStack } from "tamagui";
import { useSQLiteContext } from "expo-sqlite";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { HermesButton } from "@/components/ui/HermesButton";
import { HermesTextField } from "@/components/ui/HermesTextField.tsx";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientBorderCard } from "@/components/ui/GradientBorderCard";
import { Muted } from "@/components/ui/Typography";
import { useAppState } from "@/state/AppState";

import { llmClient } from "shared/services/llm/client";
import {
  buildApplyEvaluatorPrompt,
  buildApplyPersonaPrompt,
  continueApplyConversation,
  evaluateApplyConversation,
  fuzzyMatchTargets,
  loadApplyContext,
  startApplyConversation,
  type ApplyChatContext,
} from "shared/services/llm/applyChat";

import { listLanguageProfilesForUsername, type LanguageProfileRow } from "@/db/queries/users";
import { recordPracticeAttemptTx } from "@/db/queries/practice";
import { finalizePracticeSession } from "@/analytics/finalize";
import { startPracticeSession } from "@/db/queries/sessions";

const MVP_USERNAME = "default";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  correction?: string | null;
  feedback?: string | null;
  isCorrect?: boolean | null;
};

type TargetChipState = {
  conceptId: number;
  title: string;
  status: "active" | "celebrating" | "celebrated";
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function TargetChip({
  title,
  status,
  onCelebrateDone,
}: {
  title: string;
  status: TargetChipState["status"];
  onCelebrateDone?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== "celebrating") return;

    const shake = Animated.sequence([
      Animated.timing(translateX, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: -4,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 4,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]);

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        shake,
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onCelebrateDone?.());
  }, [status, scale, translateX, onCelebrateDone]);

  const content = (
    <YStack
      paddingHorizontal={12}
      paddingVertical={6}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
    >
      <Text fontSize={12} color="$color" fontWeight="700">
        {title}
      </Text>
    </YStack>
  );

  const body = status !== "active" ? (
    <GradientBorderCard borderRadius={999} borderWidth={1.6} padding={0}>
      {content}
    </GradientBorderCard>
  ) : (
    <YStack
      paddingHorizontal={12}
      paddingVertical={6}
      borderRadius={999}
      backgroundColor="rgba(255,255,255,0.08)"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.12)"
    >
      <Text fontSize={12} color="$color" fontWeight="700">
        {title}
      </Text>
    </YStack>
  );

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { translateX }],
      }}
    >
      {body}
    </Animated.View>
  );
}

export default function Apply() {
  const db = useSQLiteContext();
  const { activeProfileId, activeLanguageId } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [llmReady, setLlmReady] = useState<boolean>(() => llmClient.isReady());
  const [initializingLlm, setInitializingLlm] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [context, setContext] = useState<ApplyChatContext>({
    knownVocab: [],
    knownGrammar: [],
    targets: [],
  });
  const [loadingContext, setLoadingContext] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastAssistantAt, setLastAssistantAt] = useState<number | null>(null);
  const [lastPromptText, setLastPromptText] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [targets, setTargets] = useState<TargetChipState[]>([]);

  const scrollRef = useRef<ScrollView | null>(null);
  const initInFlightRef = useRef(false);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        setLoadingProfiles(true);
        const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
        if (!cancelled) setProfiles(rows);
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    }

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    let cancelled = false;

    async function initLlm() {
      if (!activeLanguageId || !activeProfileId) return;
      if (llmReady || initInFlightRef.current) return;

      initInFlightRef.current = true;
      setInitializingLlm(true);
      setLlmError(null);

      try {
        await llmClient.ensureReady();
        if (!cancelled) setLlmReady(true);
      } catch (e: any) {
        if (!cancelled) {
          setLlmError(e?.message ?? String(e));
          setLlmReady(false);
        }
      } finally {
        initInFlightRef.current = false;
        if (!cancelled) setInitializingLlm(false);
      }
    }

    initLlm();

    return () => {
      cancelled = true;
    };
  }, [activeLanguageId, activeProfileId, llmReady]);

  const refreshContext = useCallback(
    async (opts?: { targetsOnly?: boolean }) => {
      if (!activeProfileId || !activeLanguageId) return;

      try {
        setLoadingContext(true);
        const next = await loadApplyContext(db, {
          userId: activeProfileId,
          languageId: activeLanguageId,
          modelKey: "ema_v1",
        });

        if (opts?.targetsOnly) {
          setContext((prev) => ({
            ...prev,
            targets: next.targets,
          }));
        } else {
          setContext(next);
        }

        setTargets(
          next.targets.map((t) => ({
            conceptId: t.conceptId,
            title: t.title ?? `#${t.conceptId}`,
            status: "active" as const,
          }))
        );
      } catch (e) {
        console.warn("[apply] context load failed", e);
      } finally {
        setLoadingContext(false);
      }
    },
    [db, activeProfileId, activeLanguageId]
  );

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    let cancelled = false;

    async function startSessionRow() {
      if (!activeProfileId || !activeLanguageId) return;

      try {
        const newSessionId = await startPracticeSession(db, {
          languageId: activeLanguageId,
          userId: activeProfileId,
          startedAtIso: new Date().toISOString(),
          modality: "interaction",
          source: "apply",
        });

        if (!cancelled) setSessionId(newSessionId);
      } catch (e) {
        console.warn("[apply] session start failed", e);
      }
    }

    startSessionRow();

    return () => {
      cancelled = true;
    };
  }, [db, activeProfileId, activeLanguageId]);

  useEffect(() => {
    return () => {
      if (!sessionId) return;
      finalizePracticeSession(db, sessionId).catch((e) => {
        console.warn("[apply] finalize failed", e);
      });
    };
  }, [db, sessionId]);

  const personaPrompt = useMemo(() => {
    if (!activeProfile) return null;
    return buildApplyPersonaPrompt({
      learningName: activeProfile.learningName,
      learningCode: activeProfile.learningCode,
      nativeName: activeProfile.nativeName,
      knownVocab: context.knownVocab,
      knownGrammar: context.knownGrammar,
      targets: context.targets,
    });
  }, [activeProfile, context]);

  const evaluatorPrompt = useMemo(() => {
    if (!activeProfile) return null;
    return buildApplyEvaluatorPrompt({
      learningName: activeProfile.learningName,
      learningCode: activeProfile.learningCode,
      nativeName: activeProfile.nativeName,
      knownVocab: context.knownVocab,
      knownGrammar: context.knownGrammar,
      targets: context.targets,
    });
  }, [activeProfile, context]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const canStartConversation =
    !!personaPrompt &&
    llmReady &&
    !initializingLlm &&
    !loadingContext &&
    messages.length === 0;

  useEffect(() => {
    let cancelled = false;

    async function startConversation() {
      if (!canStartConversation || !personaPrompt) return;

      setSending(true);
      try {
        const assistantMessage = await startApplyConversation(
          llmClient.complete.bind(llmClient),
          personaPrompt
        );
        if (cancelled) return;

        setMessages([
          {
            id: uid(),
            role: "assistant",
            content: assistantMessage,
          },
        ]);
        setLastAssistantAt(Date.now());
        setLastPromptText(assistantMessage);
      } catch (e) {
        console.warn("[apply] initial prompt failed", e);
      } finally {
        if (!cancelled) setSending(false);
      }
    }

    startConversation();

    return () => {
      cancelled = true;
    };
  }, [canStartConversation, personaPrompt]);

  const handleCelebrateDone = useCallback((conceptId: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTargets((prev) =>
      prev.map((t) =>
        t.conceptId === conceptId ? { ...t, status: "celebrated" } : t
      )
    );
  }, []);

  useEffect(() => {
    if (targets.length === 0) return;
    const allCelebrated = targets.every((t) => t.status === "celebrated");
    if (allCelebrated && !loadingContext) {
      refreshContext({ targetsOnly: true });
    }
  }, [targets, loadingContext, refreshContext]);

  async function handleSend() {
    if (!input.trim() || !personaPrompt || !evaluatorPrompt || sending) return;

    const userMessage = input.trim();
    const responseMs = lastAssistantAt ? Math.max(0, Date.now() - lastAssistantAt) : null;

    setInput("");
    setSending(true);

    const userId = uid();
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: userId, role: "user", content: userMessage },
    ];

    setMessages(nextMessages);

    try {
      const evaluation = await evaluateApplyConversation(
        llmClient.complete.bind(llmClient),
        evaluatorPrompt,
        messages.map((m) => ({ role: m.role, content: m.content })),
        userMessage
      );

      console.log("[apply] evaluator parsed", evaluation);

      const assistantMessage = await continueApplyConversation(
        llmClient.complete.bind(llmClient),
        personaPrompt,
        messages.map((m) => ({ role: m.role, content: m.content })),
        userMessage
      );

      console.log("[apply] assistant reply", assistantMessage);

      const targetIdSet = new Set(targets.map((t) => t.conceptId));
      const fuzzyConceptIds = fuzzyMatchTargets(userMessage, context.targets);
      const fuzzyIdSet = new Set(fuzzyConceptIds);
      const evaluatorConcepts = (evaluation.evaluation.conceptResults ?? []).filter(
        (cr) => targetIdSet.has(cr.conceptId) && fuzzyIdSet.has(cr.conceptId)
      );
      const fuzzyConcepts = fuzzyConceptIds
        .filter((id) => !evaluatorConcepts.some((cr) => cr.conceptId === id))
        .map((id) => ({
          conceptId: id,
          isCorrect: true,
          score: 1,
          maxScore: 1,
          evidence: { source: "fuzzy" },
        }));

      const conceptResults = [...evaluatorConcepts, ...fuzzyConcepts];

      console.log("[apply] concept results", {
        evaluatorConcepts,
        fuzzyConceptIds,
        conceptResults,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === userId
            ? {
                ...m,
                correction: evaluation.correction,
                feedback: evaluation.evaluation.feedback ?? null,
                isCorrect:
                  typeof evaluation.evaluation.isCorrect === "boolean"
                    ? evaluation.evaluation.isCorrect
                    : null,
              }
            : m
        )
      );

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: assistantMessage },
      ]);

      setLastAssistantAt(Date.now());
      setLastPromptText(assistantMessage);

      if (conceptResults.length > 0) {
        console.log("[apply] celebrate concepts", conceptResults.map((cr) => cr.conceptId));
        setTargets((prev) =>
          prev.map((t) =>
            conceptResults.some((cr) => cr.conceptId === t.conceptId && cr.isCorrect)
              ? {
                  ...t,
                  status: t.status === "celebrated" ? "celebrated" : "celebrating",
                }
              : t
          )
        );
      }

      console.log("Apply evaluation:", evaluation);

      if (sessionId && activeProfileId) {
        await recordPracticeAttemptTx({
          db,
          sessionId,
          userId: activeProfileId,
          modality: "interaction",
          skill: "writing",
          itemType: "apply_v1.chat",
          promptText: lastPromptText ?? "",
          questionJson: {
            type: "apply_v1.chat",
            mode: "interaction",
            skills: ["writing"],
            conceptIds: context.targets.map((t) => t.conceptId),
            assistantPrompt: lastPromptText,
          },
          userResponseJson: { text: userMessage },
          evaluation: {
            type: "apply_v1.chat",
            mode: "interaction",
            skills: ["writing"],
            isCorrect: evaluation.evaluation.isCorrect,
            score: evaluation.evaluation.score,
            conceptResults,
            feedback: evaluation.evaluation.feedback,
          },
          responseMs: responseMs ?? undefined,
        });
      }
    } catch (e) {
      console.warn("[apply] send failed", e);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen noPad>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} paddingHorizontal={20}>
        <AppHeader title="Apply" />

        {loadingProfiles ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator />
          </YStack>
        ) : (
          <YStack flex={1} gap={12}>
            <GlassCard>
              <Text color="$color" fontWeight="800">
                Freeform chat practice
              </Text>
              <Muted marginTop={6}>
                Try to use the highlighted vocab and grammar. You can respond naturally.
              </Muted>

              <XStack marginTop={10} gap={8} flexWrap="wrap">
                {targets.length === 0 ? (
                  <Text color="$textMuted" fontSize={12}>
                    No targets yet. Keep practicing to unlock more.
                  </Text>
                ) : (
                  targets.map((t) => (
                    <TargetChip
                      key={`target-${t.conceptId}`}
                      title={t.title}
                      status={t.status}
                      onCelebrateDone={() => handleCelebrateDone(t.conceptId)}
                    />
                  ))
                )}
              </XStack>

              {initializingLlm ? (
                <Text marginTop={10} color="$textMuted" fontSize={12}>
                  Initializing LLM...
                </Text>
              ) : null}
              {!initializingLlm && llmReady ? (
                <Text marginTop={10} color="$green11" fontSize={12}>
                  LLM ready
                </Text>
              ) : null}
              {llmError ? (
                <Text marginTop={10} color="$red10" fontSize={12}>
                  {llmError}
                </Text>
              ) : null}
            </GlassCard>

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <YStack flex={1}>
                <ScrollView
                  ref={scrollRef}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  onContentSizeChange={scrollToBottom}
                >
                  <YStack gap={10} paddingTop={6}>
                    {messages.map((m) => (
                      <YStack
                        key={m.id}
                        alignSelf={m.role === "user" ? "flex-end" : "flex-start"}
                        maxWidth="85%"
                        gap={6}
                      >
                        <YStack
                          padding={12}
                          borderRadius={16}
                          backgroundColor={
                            m.role === "user"
                              ? "rgba(95, 176, 255, 0.18)"
                              : "rgba(255,255,255,0.08)"
                          }
                          borderWidth={1}
                          borderColor={
                            m.role === "user"
                              ? "rgba(95, 176, 255, 0.4)"
                              : "rgba(255,255,255,0.12)"
                          }
                        >
                          <Text color="$color">{m.content}</Text>
                        </YStack>

                        {m.correction ? (
                          <YStack
                            padding={10}
                            borderRadius={12}
                            backgroundColor="rgba(36, 198, 138, 0.12)"
                            borderWidth={1}
                            borderColor="rgba(36, 198, 138, 0.3)"
                          >
                            <Text color="$green11" fontSize={13} fontWeight="700">
                              Suggested correction
                            </Text>
                            <Text color="$color" fontSize={13} marginTop={4}>
                              {m.correction}
                            </Text>
                          </YStack>
                        ) : null}
                      </YStack>
                    ))}

                    {sending ? (
                      <XStack gap={8} alignItems="center" paddingVertical={6}>
                        <ActivityIndicator />
                        <Text color="$textMuted" fontSize={12}>
                          Thinking...
                        </Text>
                      </XStack>
                    ) : null}
                  </YStack>
                </ScrollView>

                <YStack gap={10} paddingVertical={12}>
                  <HermesTextField
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your message"
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    multiline
                    minHeight={80}
                  />

                  <HermesButton
                    label={sending ? "Sending..." : "Send"}
                    variant="primary"
                    disabled={!input.trim() || sending || !llmReady}
                    onPress={handleSend}
                  />
                </YStack>
              </YStack>
            </KeyboardAvoidingView>
          </YStack>
        )}
      </YStack>
    </Screen>
  );
}
