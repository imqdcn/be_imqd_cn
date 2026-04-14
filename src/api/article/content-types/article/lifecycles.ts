import crypto from 'node:crypto';

type ArticleInput = {
  password?: unknown;
  passwordHash?: unknown;
  isProtected?: unknown;
  accessLevel?: unknown;
};

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function applyPasswordHashing(data: ArticleInput | undefined) {
  if (!data) {
    return;
  }

  const plaintext = typeof data.password === 'string' ? data.password.trim() : '';

  if (plaintext) {
    data.passwordHash = hashPassword(plaintext);
    data.isProtected = true;
    data.accessLevel = 'password';
  }

  if (!plaintext && (data.accessLevel === 'public' || (data.isProtected === false && data.accessLevel !== 'password'))) {
    data.passwordHash = null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'password')) {
    delete data.password;
  }
}

export default {
  beforeCreate(event: { params?: { data?: ArticleInput } }) {
    applyPasswordHashing(event.params?.data);
  },

  beforeUpdate(event: { params?: { data?: ArticleInput } }) {
    applyPasswordHashing(event.params?.data);
  },
};
