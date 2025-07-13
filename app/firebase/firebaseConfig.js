// Import the functions you need from the SDKs you need
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBTwQ9OrAn4tsOwjv_btKzgh0oS0_myUZY",
  authDomain: "contourlinerastreador.firebaseapp.com",
  projectId: "contourlinerastreador",
  storageBucket: "contourlinerastreador.appspot.com", 
  messagingSenderId: "571468560950",
  appId: "1:571468560950:web:260e2c44bf7932c7e4b697",
  measurementId: "G-DD8RQTP233"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };

