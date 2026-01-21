import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { Button, Text, XStack, YStack } from "tamagui";
import { Trash2 } from "@tamagui/lucide-icons";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { HermesTextField } from "@/components/ui/HermesTextField.tsx";
import { HermesButton } from "@/components/ui/HermesButton";
import { HermesTagInput } from "@/components/ui/HermesTagInput";
import { useAppState } from "@/state/AppState";

import {
  createVocabItem,
  deleteVocabItem,
  getVocabItem,
  listSensesForItem,
  updateVocabItem,
  listTagsForItem,
  replaceTagsForItem,
} from "@/db/queries/vocab";

type FormState = {
  baseForm: string;
  partOfSpeech: string;
  usageNotes: string;
  translation: string;
  definition: string;
};

function toStr(v: unknown) {
  return typeof v === "string" ? v : Array.isArray(v) ? String(v[0] ?? "") : "";
}

export default function VocabEditModal() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId } = useAppState();

  const params = useLocalSearchParams();
  const idParam = toStr(params.id);
  const vocabItemId = idParam ? Number(idParam) : NaN;
  const isEdit = Number.isFinite(vocabItemId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [tags, setTags] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    baseForm: "",
    partOfSpeech: "",
    usageNotes: "",
    translation: "",
    definition: "",
  });

  const title = isEdit ? "Edit vocab" : "Add vocab";

  const canSave = useMemo(() => {
    return (
      !saving &&
      form.baseForm.trim().length > 0 &&
      form.partOfSpeech.trim().length > 0 &&
      Number.isFinite(Number(activeLanguageId))
    );
  }, [saving, form.baseForm, form.partOfSpeech, activeLanguageId]);

  const load = useCallback(async () => {
    if (!isEdit) return;

    setLoading(true);
    try {
      const it = await getVocabItem(db, vocabItemId);
      const senses = await listSensesForItem(db, vocabItemId);
      const sense1 = senses.find((s: any) => s.sense_index === 1) ?? null;

      const tg = await listTagsForItem(db, vocabItemId);

      setForm({
        baseForm: it?.base_form ?? "",
        partOfSpeech: it?.part_of_speech ?? "",
        usageNotes: it?.usage_notes ?? "",
        translation: sense1?.translation ?? "",
        definition: sense1?.definition ?? "",
      });

      setTags((tg ?? []).map((t: any) => t.name));
    } finally {
      setLoading(false);
    }
  }, [db, isEdit, vocabItemId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (k: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const onClose = () => {
    Keyboard.dismiss();
    router.back();
  };

  const onSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const languageId = Number(activeLanguageId);

      let idToUpdate = vocabItemId;

      if (isEdit) {
        await updateVocabItem(db, vocabItemId, {
          baseForm: form.baseForm,
          partOfSpeech: form.partOfSpeech,
          usageNotes: form.usageNotes || null,
          translation: form.translation || null,
          definition: form.definition || null,
        });
      } else {
        idToUpdate = await createVocabItem(db, {
          languageId,
          baseForm: form.baseForm,
          partOfSpeech: form.partOfSpeech,
          usageNotes: form.usageNotes || null,
          translation: form.translation || null,
          definition: form.definition || null,
        });
      }

      await replaceTagsForItem(db, idToUpdate, tags);

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit) return;

    Alert.alert("Delete vocab?", "This will permanently delete this vocab item.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteVocabItem(db, vocabItemId);

          router.replace("/(app)/vocab");
        },
      },
    ]);
  };


  return (
    <Screen>
      <YStack gap="$3" padding="$4">
        <XStack alignItems="center" justifyContent="space-between" paddingRight="$5">
          <AppHeader title={title} />
          {isEdit ? (
            <Button
              size="$5"
              chromeless
              icon={Trash2}
              onPress={onDelete}
              disabled={saving || loading}
              color="#d98a8a"
            />
          ) : null}
        </XStack>

        {loading ? (
          <Text color="$color11">Loading…</Text>
        ) : (
          <YStack gap="$3">
            <HermesTextField
              label="Word / lemma"
              required
              value={form.baseForm}
              onChangeText={setField("baseForm")}
              placeholder="e.g., говорить"
              autoCorrect={false}
              autoCapitalize="none"
            />

            <HermesTextField
              label="Part of speech"
              required
              value={form.partOfSpeech}
              onChangeText={setField("partOfSpeech")}
              placeholder="e.g., verb"
              autoCorrect={false}
              autoCapitalize="none"
            />

            <HermesTextField
              label="Translation (optional)"
              value={form.translation}
              onChangeText={setField("translation")}
              placeholder="e.g., to speak"
              autoCorrect={false}
              autoCapitalize="none"
            />

            <HermesTextField
              label="Definition (optional)"
              value={form.definition}
              onChangeText={setField("definition")}
              placeholder="Short definition"
              autoCorrect
              autoCapitalize="sentences"
              multiline
              minHeight={88}
            />

            <HermesTextField
              label="Notes (optional)"
              value={form.usageNotes}
              onChangeText={setField("usageNotes")}
              placeholder="Usage notes"
              autoCorrect
              autoCapitalize="sentences"
              multiline
              minHeight={88}
            />

            <HermesTagInput
              label="Tags"
              tags={tags}
              onTagsChange={setTags}
              placeholder="Type a tag and hit space…"
            />

            <XStack justifyContent="flex-end" gap="$2" marginTop="$3" width="100%">
              <HermesButton
                label="Cancel"
                variant="secondary"
                onPress={onClose}
                disabled={saving}
              />
              <HermesButton
                label={saving ? "Saving…" : "Save"}
                onPress={onSave}
                disabled={!canSave || saving}
              />
            </XStack>
          </YStack>
        )}
      </YStack>
    </Screen>
  );
}
