import type { Episode } from '../content'

export function Next({ ep, unlocked, onReplay, onPractise, onHome }: { ep: Episode; unlocked: boolean; onReplay: () => void; onPractise: () => void; onHome: () => void }) {
  return (
    <div className="story next">
      <div className="start-art dim" style={{ backgroundImage: `url(${ep.cliffhanger.image})` }} />
      <div className="cliff-shade" />
      <div className="next-body">
        <div className="kicker center">{ep.series} · Episode {ep.next.number}</div>
        <h2 className="ep-title center">{ep.next.title}</h2>
        {unlocked ? (
          <>
            <div className="placeholder">Demo placeholder<br /><span>Episode {ep.next.number} has not been produced yet. The real episode will play here.</span></div>
            <button className="cta slim" onClick={onReplay}><span className="play" />Replay Episode {ep.number}</button>
          </>
        ) : (
          <>
            <div className="placeholder lock">🔒 Episode {ep.next.number} unlocks after practice<br /><span>Complete {ep.exercises.length} quick questions to continue the story.</span></div>
            <button className="cta slim" onClick={onPractise}>Practise English · 45 sec</button>
          </>
        )}
        <button className="ghost" onClick={onHome}>Back to start</button>
      </div>
    </div>
  )
}
