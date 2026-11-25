import { useEffect, useRef, useState } from 'react'
import { episodes } from './content'
import { PROTOTYPE, SCREENS, useJourney, type Screen } from './journey'
import { Start } from './screens/Start'
import { Player } from './screens/Player'
import { Cliffhanger } from './screens/Cliffhanger'
import { Sia } from './screens/Sia'
import { Practice } from './screens/Practice'
import { StoryPractice } from './screens/StoryPractice'
import { Reward } from './screens/Reward'
import { Next } from './screens/Next'
import { setVoiceClips, unlockAudio } from './speech'

export default function App() {
  const ep = episodes[0]
  setVoiceClips(ep.voiceClips) // speaker buttons use Sia's recorded voice where a clip exists
  const { state, dispatch } = useJourney()
  const [demo, setDemo] = useState(() => new URLSearchParams(location.search).has('demo'))
  const taps = useRef<number[]>([])
  const track = (name: string, data?: Record<string, unknown>) => dispatch({ type: 'TRACK', name, data })
  const optional = state.variant === 'optional'
  const maxCoins = ep.exercises.length * ep.coinsPerCorrect

  // Hidden demo panel: press D, or tap the top-left corner four times quickly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'd' && !(e.target instanceof HTMLInputElement)) setDemo(v => !v) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const cornerTap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter(t => now - t < 1500), now]
    if (taps.current.length >= 4) { taps.current = []; setDemo(true) }
  }
  const jump = (screen: Screen) => { window.speechSynthesis?.cancel(); dispatch({ type: 'JUMP', screen }) }

  return (
    <div className="stage">
      <div className={`phone ${['sia', 'practice'].includes(state.screen) ? 'light' : 'dark'}`}>
        <div key={state.screen} className={`screen ${state.screen === 'cliffhanger' ? 'cut' : ''}`}>
          {state.screen === 'start' && <Start ep={ep} coins={state.coins} questionCount={ep.exercises.length} maxCoins={maxCoins} onStart={() => { unlockAudio(); dispatch({ type: 'START' }) }} />}
          {state.screen === 'episode' && <Player ep={ep} onEnded={() => dispatch({ type: 'EPISODE_ENDED' })} onExit={() => jump('start')} />}
          {state.screen === 'cliffhanger' && <Cliffhanger ep={ep} voiceOn={state.siaVoice} onDone={() => dispatch({ type: 'CLIFFHANGER_DONE' })} />}
          {state.screen === 'sia' && (PROTOTYPE === 2
            ? <Sia
                scene={ep.siaChoice} voiceOn={state.siaVoice} autoplay={!state.englishWatched}
                actions={[
                  { label: ep.siaChoice.ctaEnglish, icon: 'play', kind: 'secondary', onClick: () => dispatch({ type: 'WATCH_ENGLISH' }) },
                  { label: ep.siaChoice.ctaPractice, icon: 'mic', onClick: () => dispatch({ type: 'SIA_DONE' }) },
                ]}
              />
            : <Sia
                scene={ep.sia} voiceOn={state.siaVoice}
                actions={[{ label: ep.sia.cta, onClick: () => dispatch({ type: 'SIA_DONE' }) }]}
                footer={optional && <button className="link" onClick={() => dispatch({ type: 'SKIP_PRACTICE' })}>Skip practice · Watch Episode {ep.next.number}</button>}
              />)}
          {state.screen === 'episode-en' && <Player ep={ep} src={ep.englishVideo} english onEnded={() => dispatch({ type: 'ENGLISH_ENDED' })} onExit={() => dispatch({ type: 'ENGLISH_ENDED' })} />}
          {state.screen === 'practice' && (() => {
            const props = {
              ep, index: state.exIndex, lessonCoins: state.lessonCoins, optional,
              onAnswered: (correct: boolean, coins: number) => dispatch({ type: 'ANSWERED', correct, coins }),
              onNext: () => dispatch({ type: 'NEXT_EXERCISE', total: ep.exercises.length }),
              onExit: () => jump('start'), onSkipAll: () => dispatch({ type: 'SKIP_PRACTICE' }), track,
            }
            // Prototype 2 practises inside the story's scenes; prototype 1 keeps the original question screens.
            return PROTOTYPE === 2 ? <StoryPractice {...props} /> : <Practice {...props} />
          })()}
          {state.screen === 'reward' && <Reward ep={ep} lessonCoins={state.lessonCoins} totalCoins={state.coins} onContinue={() => (ep.next.available ? dispatch({ type: 'CONTINUE_STORY' }) : track('next_episode_tapped', { episode: ep.next.number }))} onClose={() => jump('start')} />}
          {state.screen === 'next' && (
            <Next ep={ep} unlocked={optional || state.practiceDone} onReplay={() => jump('episode')} onPractise={() => jump('sia')} onHome={() => jump('start')} />
          )}
        </div>
        <button className="demo-corner" aria-label="Demo settings" onClick={cornerTap} />
        {demo && (
          <aside className="demo">
            <div className="demo-head"><b>Demo settings</b><button onClick={() => setDemo(false)}>Close</button></div>
            <label>Prototype</label>
            <div className="demo-row">
              {([1, 2] as const).map(n => <button key={n} className={n === PROTOTYPE ? 'on' : ''} onClick={() => { location.search = n === 2 ? '?p=2&demo' : '?demo' }}>{n === 1 ? '1 · Practice' : '2 · English video or practice'}</button>)}
            </div>
            <label>Jump to screen</label>
            <div className="demo-row">{SCREENS.map(s => <button key={s} className={s === state.screen ? 'on' : ''} onClick={() => jump(s)}>{s}</button>)}</div>
            <label>Jump to question</label>
            <div className="demo-row">{ep.exercises.map((e, i) => <button key={e.id} className={state.screen === 'practice' && state.exIndex === i ? 'on' : ''} onClick={() => { window.speechSynthesis?.cancel(); dispatch({ type: 'JUMP_QUESTION', index: i }) }}>{i + 1} · {e.type}</button>)}</div>
            <label>Learning before Episode 2</label>
            <div className="demo-row">
              {(['mandatory', 'optional'] as const).map(v => <button key={v} className={v === state.variant ? 'on' : ''} onClick={() => dispatch({ type: 'SET_VARIANT', variant: v })}>{v}</button>)}
            </div>
            <label>Sia voice</label>
            <div className="demo-row">
              <button className={state.siaVoice ? 'on' : ''} onClick={() => dispatch({ type: 'SET_SIA_VOICE', on: true })}>on</button>
              <button className={!state.siaVoice ? 'on' : ''} onClick={() => dispatch({ type: 'SET_SIA_VOICE', on: false })}>off</button>
            </div>
            <div className="demo-row"><button onClick={() => { dispatch({ type: 'RESET' }) }}>Reset progress and coins</button><button onClick={() => { jump('start') }}>Replay from start</button></div>
            <label>Coins {state.coins} · Events ({state.events.length})</label>
            <ol className="demo-log">{state.events.slice(-10).reverse().map((e, i) => <li key={i}><b>{e.name}</b> {e.data ? JSON.stringify(e.data) : ''}<span>{e.at.slice(11, 19)}</span></li>)}</ol>
          </aside>
        )}
      </div>
    </div>
  )
}
