import { useRouter } from 'next/router';

export default function WatchPage() {
  const router = useRouter();
  const { id, episode } = router.query;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center gap-4 bg-[#0a0a0f] border-b border-white/5">
        <button 
          onClick={() => router.back()} 
          className="px-4 py-2 bg-[#1a1a24] rounded-lg text-sm hover:bg-[#2a2a35] transition"
        >
          Kembali
        </button>
        <h1 className="text-lg font-semibold text-gray-200 capitalize">
          <span className="text-white">{id?.replace(/-/g, ' ')}</span> - Episode {episode}
        </h1>
      </div>
      <div className="flex-1 w-full bg-black flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl aspect-video bg-[#0a0a0f] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(100,50,255,0.05)] border border-white/5 flex items-center justify-center">
          <p className="text-gray-500">Video Player Area</p>
        </div>
      </div>
    </div>
  );
}