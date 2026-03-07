// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } 
from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDbT3anyjwCwqBZfjeWmO2tqEUwiGatcv4",
  authDomain: "giginsaurance.firebaseapp.com",
  projectId: "giginsaurance",
  storageBucket: "giginsaurance.firebasestorage.app",
  messagingSenderId: "919332961829",
  appId: "1:919332961829:web:f4394e0ec438893c5e89cc",
  measurementId: "G-WNXBJZSR6B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById("driverForm");

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const name = document.getElementById("name").value;
  const age = Number(document.getElementById("age").value);
  const location = document.getElementById("location").value.toLowerCase();
  const income = Number(document.getElementById("income").value);
  const shift = document.getElementById("shift").value;
  const nightShift = document.getElementById("nightShift").value;

  let riskScore = 0;

  // Age risk
  if(age < 25){
    riskScore += 30;
  }

  // Night shift risk
  if(nightShift === "yes"){
    riskScore += 40;
  }

  // Get Mumbai area risk from Firebase
  let areaRisk = 0;

  const querySnapshot = await getDocs(collection(db,"riskArea"));

  querySnapshot.forEach((doc) => {

      const data = doc.data();

      if(data[location] !== undefined){
          areaRisk = data[location];
      }

  });

  riskScore += areaRisk;

  // Income calculations
  const weeklyIncome = income * 7;
  const basePremium = weeklyIncome * 0.10;
  const weeklyPremium = basePremium + (riskScore * 2);
  const dailyPremium = weeklyPremium / 7;

  // Save driver data in Firebase
  await addDoc(collection(db,"driverData"),{

    Name: name,
    Age: age,
    Location: location,
    DailyIncome: income,
    shiftTime: shift,
    NightShift: nightShift === "yes",

    areaRisk: areaRisk,
    riskScore: riskScore,
    weeklyIncome: weeklyIncome,
    weeklyPremium: weeklyPremium,
    dailyPremium: dailyPremium

  });

  // Store results locally for next page
  localStorage.setItem("insuranceResult", JSON.stringify({
    name,
    location,
    riskScore,
    areaRisk,
    weeklyIncome,
    weeklyPremium,
    dailyPremium
  }));

  // Redirect to result page
  window.location.href = "/result";

});