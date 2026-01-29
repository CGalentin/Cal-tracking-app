// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAFimL9DLPTizAtK1IVC4sJ8o56Y5jpi34',
  authDomain: 'calorie-app-chat.firebaseapp.com',
  projectId: 'calorie-app-chat',
  storageBucket: 'calorie-app-chat.firebasestorage.app',
  messagingSenderId: '244318631379',
  appId: '1:244318631379:web:7579acbe108519db026b26',
  // measurementId: 'G-XXXXXXX', // optional, if Firebase gives you one
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);