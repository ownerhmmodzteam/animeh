import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";

const pickList = (d) => d?.results || d?.result || d?.items || d?.anime || d?.data || [];
const posterOf = (a) => a?.poster || a?.thumbnail || a?.image || a?.cover || "";
const urlOf = (a) => a?.url || a?.slug || a?.href || "";
const titleOf = (a) => a?.title || a?.name || "Anime tanpa judul";

export default function Home() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [busyDetail, setBusyDetail] = useState(false);
  const [busyEpisode, setBusyEpisode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [quality, setQuality] = useState("auto");
  const [showSettings, setShowSettings] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState("");

  const load = useCallback(async (searchText = "") => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ action: searchText ? "search" : "latest", page: "1" });
      if (searchText) params.set("q", searchText);
      const r = await fetch(`/api/anime?${params}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal memuat katalog");
      setItems(pickList(data).map(item => ({ ...item, __source: item.__source || "mirainime" })));
    } catch (e) { setItems([]); setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const openDetail = async (anime) => {
    setSelected(anime); setDetail(null); setEpisode(null); setBusyDetail(true);
    try {
      const source = anime.__source || "mirainime";
      const r = await fetch(`/api/anime?source=${encodeURIComponent(source)}&action=detail&url=${encodeURIComponent(urlOf(anime))}`);
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Detail tidak tersedia");
      setDetail(data.result || data);
    } catch (e) { setError(e.message); }
    finally { setBusyDetail(false); }
  };
  const openEpisode = async (ep) => {
    setBusyEpisode(true); setEpisode(null);
    try {
      const source = ep.__source || selected?.__source || "mirainime";
      const r = await fetch(`/api/anime?source=${encodeURIComponent(source)}&action=stream&url=${encodeURIComponent(urlOf(ep))}`);
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Episode tidak tersedia");
      setEpisode(data.result || data);
    } catch (e) { setError(e.message); }
    finally { setBusyEpisode(false); }
  };
  const streams = useMemo(() => {
    const raw = episode?.streams || episode?.embeds || episode?.servers || episode?.stream || [];
    return Array.isArray(raw) ? raw : [raw];
  }, [episode]);
  const activeStream = streams[0] || null;
  const qualityOptions = streams.map((s, i) => ({
    index: i,
    label: typeof s === "object" ? (s.quality || s.resolution || s.label || s.server || "") : "",
    url: typeof s === "string" ? s : (s?.url || s?.src || s?.file || s?.streamUrl || "")
  })).filter(x => x.url && x.label && /\\d{3,4}p|auto|original|hd|sd/i.test(x.label));
  const streamUrl = typeof activeStream === "string" ? activeStream :
    activeStream?.url || activeStream?.src || activeStream?.file || activeStream?.streamUrl || activeStream?.iframe || "";
  const isVideo = /\.(mp4|m3u8|webm|ogg)(?:$|\?)/i.test(streamUrl) || activeStream?.type === "video" || activeStream?.type === "hls";
  const videoRef = (node) => { if (node && node.playbackRate !== Number(speed)) node.playbackRate = Number(speed); };
  const seek = (seconds) => {
    const v = document.querySelector("video.custom-video");
    if (v) { v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + seconds)); setSeekFeedback(`${seconds > 0 ? "+" : ""}${seconds}s`); setTimeout(() => setSeekFeedback(""), 700); }
  };

  return <>
    <Head><title>Nest Anime — Watch your next story</title><meta name="description" content="Jelajahi anime favorit dengan pengalaman menonton modern."/><meta name="theme-color" content="#090a10"/></Head>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Nest Anime home"><span className="brand-mark">N</span><span>NEST<span className="brand-accent">ANIME</span></span></a>
      <nav><a className="nav-active" href="#discover">Discover</a><a href="#catalog">Anime</a><a href="#about">About</a></nav>
      <div className="top-right"><span className="live-dot"/> <span className="status-label">MULTI SOURCE</span><button className="avatar" title="Nest Anime">N</button></div>
    </header>
    <main>
      <section className="hero" id="discover">
        <div className="hero-copy"><div className="eyebrow"><span/> YOUR NEXT OBSESSION STARTS HERE</div>
          <h1>Stories that<br/><em>stay with you.</em></h1>
          <p>Temukan dunia baru, karakter ikonik, dan kisah yang selalu ingin kamu lanjutkan.</p>
          <form className="searchbar" onSubmit={e => { e.preventDefault(); load(query.trim()); }}>
            <span className="search-icon">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari judul anime..." aria-label="Cari anime"/>
            <button type="submit" disabled={loading}>{loading ? "..." : "Search"} <span>↗</span></button>
          </form>
          <div className="hero-meta"><span><i className="tiny-check">✓</i> Semua katalog dalam satu tempat</span><span><i className="tiny-check">✓</i> Responsive player</span></div>
        </div>
        <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="poster-stack">
          <div className="poster poster-back"><div className="poster-sun"/><div className="poster-mountain"/></div>
          <div className="poster poster-front"><div className="poster-glow"/><div className="poster-figure"/><div className="poster-caption">FIND YOUR<br/><b>NEW WORLD</b></div></div>
          <div className="floating-chip chip-top"><span>✦</span> Curated for you</div><div className="floating-chip chip-bottom"><span className="chip-pulse"/> New episodes, new worlds</div>
        </div></div>
      </section>
      <section className="catalog" id="catalog">
        <div className="section-heading"><div><div className="eyebrow muted">YOUR PERSONAL ANIME HUB</div><h2>{query ? `Results for “${query}”` : "Explore anime"}<span className="heading-dot">.</span></h2><p>Pick a story. Find your next favorite.</p></div>
          <div className="catalog-note"><span className="live-dot"/> Semua katalog tersedia</div>
        </div>
        {error && <div className="error-banner"><span>!</span><div><b>Belum bisa memuat data</b><p>{error}</p></div><button onClick={()=>load(query)}>Coba lagi ↻</button></div>}
        {loading ? <div className="anime-grid">{Array.from({length:10},(_,i)=><div className="skeleton-card" key={i}><div/><span/><i/></div>)}</div> :
        items.length ? <div className="anime-grid">{items.map((anime,i)=><button className="anime-card" key={urlOf(anime)+i} onClick={()=>openDetail(anime)}>
          <div className="cover-wrap">{posterOf(anime) ? <img src={posterOf(anime)} alt={titleOf(anime)} loading={i < 6 ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.visibility="hidden";e.currentTarget.parentElement.classList.add("image-failed")}}/> : <div className="cover-placeholder">N<span>✦</span></div>}<span className="cover-type">{anime.type || anime.format || "ANIME"}</span><span className="cover-play">▶</span></div>
          <div className="card-info"><b>{titleOf(anime)}</b><span>{anime.year || anime.episode || anime.alt_title || "Anime series"} <i>•</i> {anime.rating || "SUB"}</span></div>
        </button>)}</div> : !error && <div className="empty-state"><span>✦</span><h3>Belum ada hasil</h3><p>Coba kata kunci lain atau kembali lagi sebentar.</p></div>}
      </section>
      <section className="bottom-promo" id="about"><div className="promo-icon">✦</div><div><h3>Your next favorite is one click away.</h3><p>Discover more stories, one episode at a time.</p></div><span className="promo-decoration">N.</span></section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark">N</span><span>NEST<span className="brand-accent">ANIME</span></span></a><span>Made for the stories you love.</span><span>© 2026 Nest Anime</span></footer>

    {(selected || busyDetail) && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setSelected(null);setDetail(null);setEpisode(null)}}}>
      <section className="detail-modal">
        <button className="close-btn" onClick={()=>{setSelected(null);setDetail(null);setEpisode(null)}}>×</button>
        {busyDetail ? <div className="modal-loading"><div className="spinner"/><p>Memuat detail anime…</p></div> : <div className="detail-content">
          <div className="detail-cover">{posterOf(detail || selected) && <img src={posterOf(detail || selected)} alt={titleOf(detail || selected)} decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none"}}/>}</div>
          <div className="detail-main"><div className="eyebrow muted">ANIME DETAILS</div><h2>{titleOf(detail || selected)}</h2><p className="synopsis">{detail?.synopsis || detail?.description || "Pilih episode untuk mulai menonton. Detail tambahan bergantung pada sumber scraper."}</p>
            <div className="facts">{(detail?.genres || []).slice(0,5).map(g=><span key={g}>{typeof g==="string"?g:g.name}</span>)}</div>
            <h3 className="episode-heading">Episodes <span>{(detail?.episodes || detail?.episode_list || []).length || ""}</span></h3>
            <div className="episode-list">{(detail?.episodes || detail?.episode_list || []).map((ep,i)=><button key={urlOf(ep)+i} onClick={()=>openEpisode(ep)}><span className="episode-number">{String(i+1).padStart(2,"0")}</span><span>{ep.episode || ep.title || `Episode ${i+1}`}</span><b>▶</b></button>)}</div>
            {busyEpisode && <div className="inline-loading"><div className="spinner"/> Memuat sumber video…</div>}
            {episode && <div className="watch-panel"><div className="watch-title"><div><span className="eyebrow muted">NOW PLAYING</span><h3>{episode.title || "Episode"}</h3></div><button onClick={()=>setEpisode(null)}>Tutup player</button></div>
              {isVideo && streamUrl ? <div className="player-shell"><video ref={videoRef} className="custom-video" src={streamUrl} controls={false} playsInline onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onClick={e=>{const v=e.currentTarget;v.paused?v.play():v.pause()}}/><button className="center-play" onClick={()=>{const v=document.querySelector("video.custom-video");if(v){v.paused?v.play():v.pause();setPlaying(!v.paused)}}}>{playing?"Ⅱ":"▶"}</button><button className="seek-back" onClick={()=>seek(-10)}>↶ <small>10</small></button><button className="seek-forward" onClick={()=>seek(10)}>↷ <small>10</small></button>{seekFeedback && <span className="seek-feedback">{seekFeedback}</span>}<button className="settings-btn" onClick={()=>setShowSettings(!showSettings)}>⚙</button>{showSettings&&<div className="player-settings"><label>Kecepatan<select value={speed} onChange={e=>{setSpeed(e.target.value);const v=document.querySelector("video.custom-video");if(v)v.playbackRate=Number(e.target.value)}}>{["0.5","0.75","1","1.25","1.5","1.75","2"].map(s=><option key={s} value={s}>{s==="1"?"Normal":s+"×"}</option>)}</select></label><label>Kualitas<select value={String(quality)} disabled={qualityOptions.length < 2} onChange={e=>{const index=Number(e.target.value);setQuality(e.target.value);setEpisode({...episode,streams:[streams[index],...streams.filter((_,j)=>j!==index)]});setShowSettings(false)}}><option value="0">Otomatis / {qualityOptions[0]?.label || "Sumber utama"}</option>{qualityOptions.slice(1).map(o=><option key={o.index} value={o.index}>{o.label}</option>)}</select></label><small>{qualityOptions.length > 1 ? "Pilih kualitas yang disediakan sumber." : "Sumber ini tidak menyediakan beberapa kualitas video."}</small></div>}</div> :
                streamUrl ? <div className="iframe-player"><iframe src={activeStream?.iframe || streamUrl} title="Anime episode player" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="no-referrer-when-downgrade"/><span>Jika player tidak muncul, sumber mungkin memblokir embed.</span></div> :
                <div className="no-stream">Sumber ini belum mengembalikan URL video atau iframe yang bisa diputar.</div>}
              <div className="server-list">{streams.map((s,i)=><button key={i} onClick={()=>{const u=typeof s==="string"?s:s.url||s.src||s.file||s.streamUrl||s.iframe;if(u){setEpisode({...episode,streams:[s,...streams.filter((_,j)=>j!==i)]});setShowSettings(false)}}}>Pilihan {i+1} <span>↗</span></button>)}</div>
            </div>}
          </div>
        </div>}
      </section>
    </div>}
  </>;
}