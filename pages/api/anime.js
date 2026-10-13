export default async function handler(req, res) {
  try {
    const dummyData = [
      { id: "hack-sign", title: ".hack//Sign", image: "" },
      { id: "11eyes", title: "11Eyes", image: "" },
      { id: "naruto", title: "Naruto", image: "" }
    ];
    res.status(200).json({ success: true, data: dummyData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal memuat data dari sumber." });
  }
}