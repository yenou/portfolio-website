import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAJySSg4ENDONgLHos-f-IJmGNemjJppas",
  authDomain: "yenou-photographie.firebaseapp.com",
  projectId: "yenou-photographie",
  storageBucket: "yenou-photographie.firebasestorage.app",
  messagingSenderId: "404365240918",
  appId: "1:404365240918:web:cd07b192ce1556f8ab29f7"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
