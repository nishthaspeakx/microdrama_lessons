import type { Episode } from '../content'

export function Start({ ep, coins, questionCount, maxCoins, onStart }: { ep: Episode; coins: number; questionCount: number; maxCoins: number; onStart: () => void }) {
  return (
    <div className="story start">
      <div className="start-art" style={{ backgroundImage: `url(${ep.poster})` }} />
      <div className="shade-top" />
      <div className="shade-bottom" />
      <div className="start-top">
        <div className="brand">Speak<i>X</i></div>
        {coins > 0
          ? <div className="coin-chip"><span className="coin" />{coins}</div>
          : <div className="tag">Learn English through stories</div>}
      </div>
      <div className="start-body">
        <div className="kicker">Microdrama · {ep.totalEpisodes} episodes</div>
        <h1 className="series">{ep.series}</h1>
        <div className="series-en">{ep.seriesEnglish}</div>
        <div className="meta"><span className="chip">EPISODE {ep.number}</span><span>{ep.duration}</span><span className="dot" /><span>Hindi</span></div>
        <div className="ep-title">{ep.title}</div>
        <div className="ep-en">{ep.titleEnglish}</div>
        <p className="hook">{ep.hook}</p>
        <button className="cta" onClick={onStart}><span className="play" />Watch Episode {ep.number}</button>
        <div className="perks">
          <span className="perk"><MicIcon />{questionCount} quick questions</span>
          <span className="sep" />
          <span className="perk"><span className="coin" />Earn {maxCoins} coins</span>
        </div>
      </div>
    </div>
  )
}

export function MicIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill={color} stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}
