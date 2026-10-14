const CONFIG_SISTEM = {
  api_base: "https://www.sankavollerei.web.id",
  // Hybrid backend. Set to your deployed backend URL when hosting separately.
  hybrid_api_base: "",

  anime_sources: [
    "samehadaku",
    "animekuindo",
    "kusonime",
    "nimegami",
    "oploverz",
    "winbu",
    "animasu",
    "alqanime",
    "animekompi",
    "kura"
  ],

  comic_sources: [
    "komikindo",
    "shinigami",
    "westmanga",
    "bacakomik",
    "softkomik",
    "kiryuu",
    "mangakita",
    "maid",
    "mangasusuku",
    "komikstation",
    "meganei"
  ],

  request: {
    timeout: 15000
  },

  firebase: {
    apiKey: "AIzaSyDEyimcJOOFkVoexTwEvXIVmElpYhkeMP0",
    authDomain: "who-77.firebaseapp.com",
    databaseURL: "https://who-77-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "who-77",
    storageBucket: "who-77.firebasestorage.app",
    messagingSenderId: "",
    appId: ""
  },

  firebasePaths: {
    bannedDevices: "banned_devices",
    animeReviews: "Anime/reviews",
    manhwaReviews: "Manhwa/reviews"
  }
};