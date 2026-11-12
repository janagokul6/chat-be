import { config } from "./config";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  projectId: config.firebaseProjectId,
});

export const firestore = getFirestore();
firestore.settings({ ignoreUndefinedProperties: true });
