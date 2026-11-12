import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export const config = {
  get port(): number {
    return Number(process.env.PORT || "3000");
  },
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get firebaseProjectId(): string {
    return process.env.FIREBASE_PROJECT_ID || required("FIREBASE_PROJECT_ID");
  },
};
