require('dotenv').config();

function required(name) {
    // eslint-disable-next-line expo/no-dynamic-env-var
    const value = process.env[name];
    if (!value || value.trim() === '') {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

const PORT = Number(required('PORT'));
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const DB_PATH = required('DB_PATH');

module.exports = {
    PORT,
    DB_PATH,
    NODE_ENV: process.env.NODE_ENV || 'development',
}