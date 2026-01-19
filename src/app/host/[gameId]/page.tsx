"use client"

import { useEffect, useState, useCallback, use } from "react"
import { supabase, type Game, type Player, type GameEvent } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { QRCodeSVG } from "qrcode.react"
import { motion, AnimatePresence } from "framer-motion"
import { useDevMode } from "@/components/DevMode"

const FTX_MESSAGES = [
  "Yield is up! Your funds are SAFU!",
  "FTX is the most liquid exchange on earth.",
  "We have the best risk management in the industry.",
  "Customer funds are always 1:1 backed.",
  "FTX reserves are fully audited.",
  "Trust the process. Your assets are secure.",
]

const JOURNALIST_EVENTS = [
  { time: 120, message: "BREAKING: Report suggests FTX and Alameda Research are mixing customer funds" },
  { time: 180, message: "ALERT: FTT Token value crashing — down 40% in the last hour" },
  { time: 240, message: "LEAKED: Internal memo reveals 'the vault may be empty'" },
]

const PAUSE_EXPLANATIONS = [
  { 
    minute: 0, 
    title: "The Honeymoon Phase", 
    points: [
      { icon: "account_balance", text: "Welcome to FTX: The world's most trusted exchange." },
      { icon: "trending_up", text: "Deposit $100: Watch it grow +1% every second." },
      { icon: "verified", text: "The \"SAFU\" Promise: Your funds are 1:1 backed and fully liquid." },
      { icon: "rocket_launch", text: "SBF's Vision: \"We're building the future of finance.\"" }
    ]
  },
  { 
    minute: 1, 
    title: "The Hidden Backdoor", 
    points: [
      { icon: "savings", text: "The Truth: FTX is a \"Personal Piggy Bank.\"" },
      { icon: "backup", text: "The Backdoor: $8 Billion moved to Alameda Research." },
      { icon: "casino", text: "The Buy-In: They're using your cash to make risky bets." },
      { icon: "visibility_off", text: "The Illusion: Your balance is rising, but the vault is emptying." }
    ]
  },
  { 
    minute: 2, 
    title: "The First Cracks", 
    points: [
      { icon: "article", text: "Breaking News: \"Are FTX and Alameda mixing funds?\"" },
      { icon: "trending_down", text: "The FTT Crash: Native token drops -40%." },
      { icon: "campaign", text: "SBF Tweets: \"FTX is fine. Assets are fine.\" (Deleted later)" },
      { icon: "help", text: "Decision Time: Do you trust the CEO or the rumors?" }
    ]
  },
  { 
    minute: 3, 
    title: "The Bank Run", 
    points: [
      { icon: "trending_down", text: "Total Panic: Rival exchanges are dumping FTX tokens." },
      { icon: "logout", text: "The $6 Billion Exit: Everyone is hitting 'Withdraw' at once." },
      { icon: "hourglass_empty", text: "The Freeze is Coming: Withdrawals are slowing down." },
      { icon: "warning", text: "FINAL WARNING: Get out now or go down with the ship." }
    ]
  },
  { 
    minute: 4, 
    title: "The Collapse", 
    points: [
      { icon: "lock", text: "GAME OVER: Withdrawals Frozen." },
      { icon: "money_off", text: "The Reality: $8 Billion Missing." },
      { icon: "gavel", text: "The Verdict: SBF sentenced to 25 years." },
      { icon: "account_balance_wallet", text: "Total Claims: $100+ | Actual Cash: $0.00" }
    ]
  },
]

export default function HostPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params)
  const { isDevMode, setCurrentStep, setGameId } = useDevMode()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [events, setEvents] = useState<GameEvent[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentStoryTime, setCurrentStoryTime] = useState<{ index: number; title: string; points: Array<{ icon: string; text: string }> } | null>(null)
  const [lastFtxMessage, setLastFtxMessage] = useState("")
  const [showJournalist, setShowJournalist] = useState(false)
  const [journalistMessage, setJournalistMessage] = useState("")
  const [screenShake, setScreenShake] = useState(false)
  const [totalVault, setTotalVault] = useState(0)
  const [withdrawnPlayers, setWithdrawnPlayers] = useState(0)

  useEffect(() => {
    setGameId(gameId)
  }, [gameId, setGameId])

  useEffect(() => {
    if (!game) return
    
    if (game.status === "waiting") {
      setCurrentStep(1)
    } else if (game.status === "playing") {
      setCurrentStep(2)
    } else if (game.status === "ended") {
      setCurrentStep(4)
    }
  }, [game, setCurrentStep])

  const fetchGame = useCallback(async () => {
    const { data } = await supabase.from("games").select().eq("id", gameId).single()
    if (data) setGame(data)
  }, [gameId])

  const fetchPlayers = useCallback(async () => {
    const { data } = await supabase
      .from("players")
      .select()
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
    if (data) {
      setPlayers(data)
      setWithdrawnPlayers(data.filter(p => p.has_withdrawn).length)
    }
  }, [gameId])

  useEffect(() => {
    fetchGame()
    fetchPlayers()

    const gameChannel = supabase
      .channel("game-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => fetchGame())
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => fetchPlayers())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` }, (payload) => {
        const event = payload.new as GameEvent
        setEvents(prev => [...prev, event])
      })
      .subscribe()

    return () => { supabase.removeChannel(gameChannel) }
  }, [gameId, fetchGame, fetchPlayers])

  useEffect(() => {
    if (game?.status !== "playing") return

    const timer = setInterval(() => {
      if (!game.started_at) return
      const start = new Date(game.started_at).getTime()
      const elapsed = Math.floor((Date.now() - start) / 1000)
      setElapsedSeconds(elapsed)

      const activePlayerCount = players.filter(p => !p.has_withdrawn).length
      const baseVault = activePlayerCount * 100
      const growth = baseVault * (1 + 0.01 * elapsed)
      setTotalVault(growth)

      if (elapsed >= 300) {
        endGame()
      }
    }, 100)

    return () => clearInterval(timer)
  }, [game, players])

  useEffect(() => {
    if (game?.status !== "playing") return

    const ftxInterval = setInterval(() => {
      if (elapsedSeconds < 240) {
        const msg = FTX_MESSAGES[Math.floor(Math.random() * FTX_MESSAGES.length)]
        setLastFtxMessage(msg)
        supabase.from("game_events").insert({ game_id: gameId, event_type: "ftx_message", message: msg })
      }
    }, 30000)

    return () => clearInterval(ftxInterval)
  }, [game, elapsedSeconds, gameId])

  useEffect(() => {
    if (game?.status !== "playing") return

    JOURNALIST_EVENTS.forEach(event => {
      if (elapsedSeconds >= event.time && elapsedSeconds < event.time + 2) {
        setJournalistMessage(event.message)
        setShowJournalist(true)
        setScreenShake(true)
        supabase.from("game_events").insert({ game_id: gameId, event_type: "journalist", message: event.message })
        setTimeout(() => setScreenShake(false), 500)
        setTimeout(() => setShowJournalist(false), 8000)
      }
    })
  }, [elapsedSeconds, game, gameId])

  useEffect(() => {
    if (game?.status !== "playing") {
      setCurrentStoryTime(null)
      return
    }

    // Determine which story time we're currently in
    let currentIndex = -1
    for (let i = 0; i < PAUSE_EXPLANATIONS.length; i++) {
      const storyTime = PAUSE_EXPLANATIONS[i]
      const storyTimeSeconds = storyTime.minute * 60
      const nextStoryTimeSeconds = i < PAUSE_EXPLANATIONS.length - 1 
        ? PAUSE_EXPLANATIONS[i + 1].minute * 60 
        : 300 // End of game at 5 minutes

      if (elapsedSeconds >= storyTimeSeconds && elapsedSeconds < nextStoryTimeSeconds) {
        currentIndex = i
        break
      }
    }

    if (currentIndex >= 0) {
      const story = PAUSE_EXPLANATIONS[currentIndex]
      setCurrentStoryTime({ index: currentIndex, title: story.title, points: story.points })
    } else {
      setCurrentStoryTime(null)
    }
  }, [elapsedSeconds, game])

  const startGame = async () => {
    await supabase.from("games").update({ status: "playing", started_at: new Date().toISOString() }).eq("id", gameId)
    await supabase.from("game_events").insert({ game_id: gameId, event_type: "game_start", message: "Game has started!" })
    setCurrentStep(2)
  }


  const endGame = async () => {
    await supabase.from("games").update({ status: "ended", total_vault_display: totalVault, actual_vault: 0 }).eq("id", gameId)
    await supabase.from("game_events").insert({ game_id: gameId, event_type: "game_end", message: "FTX has filed for bankruptcy." })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount)
  }

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}?code=${game?.code}` : ""

  if (!game) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>
  }

  if (game.status === "ended") {
    const totalClaims = players.reduce((sum, p) => sum + Number(p.balance), 0)
    const totalWithdrawn = players.reduce((sum, p) => sum + Number(p.withdrawn_amount), 0)

    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="crypto-card rounded-2xl p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-4xl font-bold neon-text-red mb-2">BANKRUPTCY FILING</h1>
          <p className="text-muted-foreground mb-8">FTX Trading Ltd. - Chapter 11</p>
          
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-background/50 rounded-xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Total Customer Claims</p>
              <p className="text-3xl font-bold neon-text-green">{formatMoney(totalClaims + totalWithdrawn)}</p>
            </div>
            <div className="bg-background/50 rounded-xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Actual Cash Available</p>
              <p className="text-3xl font-bold neon-text-red">{formatMoney(0)}</p>
            </div>
          </div>

          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6">
            <p className="text-destructive font-medium">
              {withdrawnPlayers} of {players.length} players escaped with {formatMoney(totalWithdrawn)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {players.length - withdrawnPlayers} players lost everything when withdrawals froze
            </p>
          </div>

          <p className="text-muted-foreground text-sm">
            This is exactly what happened to FTX customers in November 2022.
            <br />Trust hid insolvency until it was too late.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen grid-bg p-4 ${screenShake ? "animate-screen-shake" : ""} ${showJournalist ? "animate-red-flash" : ""}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold neon-text-green">FTT-al Flaw</h1>
            <p className="text-muted-foreground">Game Master View</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-mono font-bold neon-text-blue">{formatTime(elapsedSeconds)}</p>
            <p className="text-muted-foreground text-sm">of 5:00</p>
          </div>
        </div>

        {game.status === "waiting" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="crypto-card rounded-2xl p-6 text-center">
              <h2 className="text-xl font-semibold mb-4">Join Code</h2>
              <p className="text-5xl font-mono font-bold neon-text-green tracking-widest mb-4">{game.code}</p>
              <div className="bg-white p-4 rounded-xl inline-block mb-4">
                <QRCodeSVG value={joinUrl} size={200} />
              </div>
              <p className="text-muted-foreground text-sm">Scan to join or enter code at homepage</p>
            </div>

            <div className="crypto-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Players ({players.length})</h2>
                <span className="text-muted-foreground text-sm">Need at least 2</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {players.map((player, i) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2"
                  >
                    <span>{player.name}</span>
                    <span className="text-[#00ff88] font-mono">{formatMoney(player.balance)}</span>
                  </motion.div>
                ))}
                {players.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Waiting for players...</p>
                )}
              </div>
              <Button
                onClick={startGame}
                disabled={players.length < 2}
                className="w-full bg-[#00ff88] hover:bg-[#00dd77] text-black font-semibold h-12"
              >
                START GAME
              </Button>
            </div>
          </div>
        )}

        {game.status === "playing" && (
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-80 flex-shrink-0 space-y-4">
              <div className="crypto-card rounded-full p-4">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs mb-1">FTX TOTAL VAULT BALANCE</p>
                  <p className="text-3xl font-bold neon-text-green animate-pulse-glow font-mono">
                    {formatMoney(totalVault)}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">+1% per second • {players.filter(p => !p.has_withdrawn).length} active depositors</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="crypto-card rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Players</p>
                  <p className="text-xl font-bold">{players.length}</p>
                </div>
                <div className="crypto-card rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Withdrawn</p>
                  <p className="text-xl font-bold text-[#00d4ff]">{withdrawnPlayers}</p>
                </div>
                <div className="crypto-card rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Phase</p>
                  <p className="text-xl font-bold">{elapsedSeconds < 240 ? "Normal" : <span className="neon-text-red">CRISIS</span>}</p>
                </div>
              </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 space-y-6">
              {/* Story Time - Fixed at top, appears immediately */}
              {currentStoryTime && (() => {
                const storyTimeSeconds = PAUSE_EXPLANATIONS[currentStoryTime.index].minute * 60
                const nextStoryTimeSeconds = currentStoryTime.index < PAUSE_EXPLANATIONS.length - 1
                  ? PAUSE_EXPLANATIONS[currentStoryTime.index + 1].minute * 60
                  : 300 // End of game
                const timeRemaining = nextStoryTimeSeconds - elapsedSeconds
                const totalDuration = nextStoryTimeSeconds - storyTimeSeconds
                const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100))

                return (
                  <div className="crypto-card rounded-2xl p-6 border-[#00d4ff]/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[#00d4ff] font-semibold">STORY TIME</span>
                        <span className="text-xs text-muted-foreground">
                          {currentStoryTime.index + 1} / {PAUSE_EXPLANATIONS.length}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {Math.max(0, timeRemaining)}s remaining
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold mb-3">{currentStoryTime.title}</h3>
                    <div className="space-y-2 mb-4">
                      {currentStoryTime.points.map((point, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-muted-foreground text-sm">
                          <span className="material-symbols-outlined text-[#00d4ff] flex-shrink-0 mt-0.5" style={{ fontSize: '20px' }}>
                            {point.icon}
                          </span>
                          <span className="leading-relaxed">{point.text}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="w-full bg-background/50 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#00d4ff] to-[#00ff88]"
                        initial={{ width: "100%" }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Player Status */}
              <div className="crypto-card rounded-xl p-4">
                <h3 className="font-semibold mb-3">Player Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {players.map(player => (
                    <div
                      key={player.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        player.has_withdrawn
                          ? "bg-[#00d4ff]/20 border border-[#00d4ff]/30"
                          : "bg-background/50"
                      }`}
                    >
                      <p className="truncate font-medium">{player.name}</p>
                      <p className={`font-mono text-xs ${player.has_withdrawn ? "text-[#00d4ff]" : "text-[#00ff88]"}`}>
                        {player.has_withdrawn ? "ESCAPED" : formatMoney(player.balance)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FTX Messages */}
              {lastFtxMessage && (
                <motion.div
                  key={lastFtxMessage}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="crypto-card rounded-xl p-4 border-[#00ff88]/30"
                >
                  <p className="text-sm text-muted-foreground mb-1">FTX Official</p>
                  <p className="text-lg neon-text-green">{lastFtxMessage}</p>
                </motion.div>
              )}

              {/* Journalist Messages */}
              <AnimatePresence>
                {showJournalist && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="crypto-card rounded-xl p-6 border-destructive/50 bg-destructive/10"
                  >
                    <p className="text-sm text-destructive mb-1 font-semibold">⚡ BREAKING NEWS</p>
                    <p className="text-xl neon-text-red">{journalistMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
