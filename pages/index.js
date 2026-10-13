import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [animes, setAnimes] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/anime')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAnimes(data.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-2 text-[#e2e2e2]">Explore anime.</h1>
        <p className="text-gray-400">Pick a story. Find your next favorite.</p>
      </header>
      
      {loading && <div className="text-gray-400">Memuat data...</div>}
      
      {error && !loading && (
        <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl text-red-200 max-w-md">
          Belum bisa memuat data. Sumber sedang tidak tersedia atau terlalu lama merespons.
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-red-800/50 rounded-lg text-sm w-full hover:bg-red-800/70 transition">
            Coba lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {!loading && !error && animes.map(anime => (
          <Link href={`/anime/${anime.id}`} key={anime.id}>
            <div className="group cursor-pointer">
              <div className="aspect-[3/4] bg-[#1a1a24] rounded-xl overflow-hidden mb-3 relative">
                {anime.image && <img src={anime.image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
              </div>
              <h3 className="font-semibold text-gray-200 group-hover:text-white truncate">{anime.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}