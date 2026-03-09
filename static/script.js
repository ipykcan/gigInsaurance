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

document.addEventListener("DOMContentLoaded", function(){

  const slides = document.querySelectorAll(".carousel-slide");
  const dots = document.querySelectorAll(".carousel-dot");
  const prevBtn = document.querySelector(".carousel-prev");
  const nextBtn = document.querySelector(".carousel-next");

  let currentSlide = 0;

  function showSlide(index){

    if(index >= slides.length) index = 0;
    if(index < 0) index = slides.length - 1;

    slides.forEach((slide,i)=>{
      slide.classList.remove("active");
      if(i===index){
        slide.classList.add("active");
      }
    });

    dots.forEach((dot,i)=>{
      dot.classList.remove("active");
      if(i===index){
        dot.classList.add("active");
      }
    });

    currentSlide = index;

  }

  if(nextBtn){
    nextBtn.addEventListener("click",()=>showSlide(currentSlide+1));
  }

  if(prevBtn){
    prevBtn.addEventListener("click",()=>showSlide(currentSlide-1));
  }

  dots.forEach((dot,index)=>{
    dot.addEventListener("click",()=>showSlide(index));
  });

});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById("insuranceForm");

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const name = document.getElementById("fullName").value;
  const age = Number(document.getElementById("age").value);
  const location = document.getElementById("location").value.toLowerCase();
  const income = Number(document.getElementById("dailyIncome").value);
  const shiftStart = document.getElementById("shiftStartTime").value;
  const shiftEnd = document.getElementById("shiftEndTime").value;
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
    shiftStartTime: shiftStart,
    shiftEndTime: shiftEnd,
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
