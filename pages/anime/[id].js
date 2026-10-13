import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AnimeDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);

  useEffect(() => {
    if (id) {
      fetch(`/api/anime?id=${id}`)
        .then(res => res.json())
        .then(resData => {
            if(resData.success) {
                setData(resData.data);
            }
        }).catch(() => {
            setData({
                id: id,
                title: id.replace(/-/g, ' ').toUpperCase(),
                synopsis: "Tonton " + id.replace(/-/g, ' ') + " bersubtitle Indonesia di sini. Tersedia dan bisa langsung ditonton kapan saja lewat ponsel tanpa biaya dan tanpa akun.",
                genres: ["Animation", "Action", "Adventure"],
                episodes: [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }]
            });
        });
    }
  }, [id]);

  if (!data) return <div className="min-h-screen bg-[#0a0a0f] text-white flex justify-center items-center">Memuat...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-12">
      <button 
        onClick={() => router.push('/')} 
        className="mb-8 px-4 py-2 bg-[#1a1a24] rounded-lg border border-white/5 hover:bg-[#2a2a35] transition"
      >
        Kembali
      </button>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{data.title}</h1>
        <p className="text-gray-400 leading-relaxed mb-8">{data.synopsis}</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {data.genres?.map(genre => (
            <span key={genre} className="px-3 py-1 bg-[#1a1a24] border border-white/10 rounded-full text-sm">
              {genre}
            </span>
          ))}
        </div>
        <h2 className="text-2xl font-semibold mb-4">Episodes</h2>
        <div className="flex flex-col gap-3">
          {data.episodes?.map((eps) => (
            <Link href={`/watch/${id}/${eps.number}`} key={eps.number}>
              <div className="p-4 bg-[#14141d] rounded-xl border border-white/5 hover:border-white/20 transition flex justify-between items-center group cursor-pointer shadow-lg shadow-black/20">
                <span className="font-medium text-gray-200 group-hover:text-white">EP {eps.number}</span>
                <span className="text-purple-500 group-hover:text-purple-400">&#9658;</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}