"use client"

import { useEffect, useState, useCallback, use } from "react"
import { supabase, type Game, type Player, type GameEvent } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useDevMode } from "@/components/DevMode"

export default function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params)
  const { setCurrentStep } = useDevMode()
  const [game, setGame] = useState<Game | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [balance, setBalance] = useState(100)
  const [hasWithdrawn, setHasWithdrawn] = useState(false)
  const [withdrawnAmount, setWithdrawnAmount] = useState(0)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawFailed, setWithdrawFailed] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [ftxMessage, setFtxMessage] = useState("")
  const [journalistMessage, setJournalistMessage] = useState("")
  const [showJournalist, setShowJournalist] = useState(false)
  const [screenShake, setScreenShake] = useState(false)

  useEffect(() => {
    if (game?.status === "playing" || game?.status === "paused") {
      setCurrentStep(3)
    } else if (game?.status === "ended") {
      setCurrentStep(4)
    }
  }, [game, setCurrentStep])

  const fetchGame = useCallback(async () => {
    const { data } = await supabase.from("games").select().eq("id", gameId).single()
    if (data) {
      setGame(data)
    }
  }, [gameId])

  const fetchPlayer = useCallback(async () => {
    const playerId = localStorage.getItem("playerId")
    if (!playerId) return
    const { data } = await supabase.from("players").select().eq("id", playerId).single()
    if (data) {
      setPlayer(data)
      setBalance(data.balance)
      setHasWithdrawn(data.has_withdrawn)
      setWithdrawnAmount(data.withdrawn_amount)
    }
  }, [])

  useEffect(() => {
    fetchGame()
    fetchPlayer()

    const channel = supabase
      .channel("player-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => fetchGame())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` }, (payload) => {
        const event = payload.new as GameEvent
        if (event.event_type === "ftx_message") {
          setFtxMessage(event.message)
          setTimeout(() => setFtxMessage(""), 10000)
        } else if (event.event_type === "journalist") {
          setJournalistMessage(event.message)
          setShowJournalist(true)
          setScreenShake(true)
          setTimeout(() => setScreenShake(false), 500)
          setTimeout(() => setShowJournalist(false), 8000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId, fetchGame, fetchPlayer])

  useEffect(() => {
    if (game?.status !== "playing" || hasWithdrawn) return

    const timer = setInterval(() => {
      if (!game.started_at) return
      const start = new Date(game.started_at).getTime()
      const elapsed = Math.floor((Date.now() - start) / 1000)
      setElapsedSeconds(Math.max(0, elapsed))
      
      const newBalance = 100 * (1 + 0.01 * Math.max(0, elapsed))
      setBalance(newBalance)
    }, 100)

    return () => clearInterval(timer)
  }, [game, hasWithdrawn])

  const handleWithdraw = async () => {
    if (!player || hasWithdrawn || isWithdrawing) return

    if (elapsedSeconds >= 240) {
      setIsWithdrawing(true)
      await new Promise(resolve => setTimeout(resolve, 3000))
      setWithdrawFailed(true)
      setIsWithdrawing(false)
      return
    }

    setIsWithdrawing(true)
    
    const { error } = await supabase
      .from("players")
      .update({ has_withdrawn: true, withdrawn_amount: balance, balance: 0 })
      .eq("id", player.id)

    if (!error) {
      setHasWithdrawn(true)
      setWithdrawnAmount(balance)
      setShowSuccess(true)
    }
    setIsWithdrawing(false)
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!game || !player) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (game.status === "waiting") {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="crypto-card rounded-2xl p-8 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 rounded-full bg-[#00ff88]/20 flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00ff88] animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome, {player.name}!</h1>
          <p className="text-muted-foreground mb-6">Waiting for the game to start...</p>
          <div className="bg-background/50 rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Your Starting Balance</p>
            <p className="text-3xl font-bold neon-text-green font-mono">{formatMoney(100)}</p>
          </div>
        </motion.div>
      </div>
    )
  }

  if (game.status === "ended") {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="crypto-card rounded-2xl p-8 text-center max-w-md w-full"
        >
          <div className="text-6xl mb-4">{hasWithdrawn ? "🎉" : "💸"}</div>
          <h1 className="text-3xl font-bold mb-2">
            {hasWithdrawn ? (
              <span className="neon-text-green">You Escaped!</span>
            ) : (
              <span className="neon-text-red">You Lost Everything</span>
            )}
          </h1>
          
          {hasWithdrawn ? (
            <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-muted-foreground mb-1">You withdrew</p>
              <p className="text-3xl font-bold neon-text-green font-mono">{formatMoney(withdrawnAmount)}</p>
            </div>
          ) : (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-muted-foreground mb-1">Lost balance</p>
              <p className="text-3xl font-bold neon-text-red font-mono">{formatMoney(balance)}</p>
              <p className="text-sm text-destructive mt-2">Withdrawals were frozen</p>
            </div>
          )}

          <p className="text-muted-foreground text-sm">
            {hasWithdrawn
              ? "You were one of the lucky few who got out in time."
              : "This is what happened to millions of FTX customers in 2022."}
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen grid-bg p-4 ${screenShake ? "animate-screen-shake" : ""} ${showJournalist ? "animate-red-flash" : ""}`}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-muted-foreground text-sm">FTX Exchange</p>
            <p className="font-semibold">{player.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-bold neon-text-blue">{formatTime(elapsedSeconds)}</p>
          </div>
        </div>

        <motion.div
          layout
          className="crypto-card rounded-2xl p-6 mb-4"
        >
          <p className="text-sm text-muted-foreground text-center mb-2">YOUR DIGITAL BALANCE</p>
          <p className="text-5xl font-bold text-center neon-text-green font-mono animate-pulse-glow">
            {hasWithdrawn ? formatMoney(0) : formatMoney(balance)}
          </p>
          {!hasWithdrawn && (
            <p className="text-center text-[#00ff88]/60 text-sm mt-2">+1% per second</p>
          )}
        </motion.div>

        {showSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="crypto-card rounded-xl p-6 mb-4 border-[#00d4ff]/50 bg-[#00d4ff]/10 text-center"
          >
            <div className="text-4xl mb-2">✓</div>
            <p className="text-xl font-bold neon-text-blue mb-1">Transfer Complete!</p>
            <p className="text-muted-foreground">You escaped with {formatMoney(withdrawnAmount)}</p>
          </motion.div>
        ) : withdrawFailed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="crypto-card rounded-xl p-6 mb-4 border-destructive/50 bg-destructive/10 text-center"
          >
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-xl font-bold neon-text-red mb-1">Withdrawals Paused</p>
            <p className="text-muted-foreground text-sm">High network traffic. Please try again later.</p>
          </motion.div>
        ) : (
          <Button
            onClick={handleWithdraw}
            disabled={hasWithdrawn || isWithdrawing}
            className={`w-full h-16 text-xl font-bold rounded-xl transition-all ${
              isWithdrawing
                ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500"
                : "bg-[#00d4ff] hover:bg-[#00bbdd] text-black"
            }`}
          >
            {isWithdrawing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : hasWithdrawn ? (
              "WITHDRAWN"
            ) : (
              "WITHDRAW ALL"
            )}
          </Button>
        )}

        <AnimatePresence>
          {ftxMessage && !showJournalist && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="crypto-card rounded-xl p-4 mt-4 border-[#00ff88]/20"
            >
              <p className="text-xs text-muted-foreground mb-1">FTX Official</p>
              <p className="text-sm neon-text-green">{ftxMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showJournalist && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="crypto-card rounded-xl p-4 mt-4 border-destructive/50 bg-destructive/10"
            >
              <p className="text-xs text-destructive font-semibold mb-1">⚡ BREAKING NEWS</p>
              <p className="text-sm neon-text-red">{journalistMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>


        <div className="mt-6 text-center">
          <p className="text-muted-foreground text-xs">
            {elapsedSeconds < 240 ? (
              "Your funds are secure with FTX"
            ) : (
              <span className="text-destructive">Network experiencing high traffic</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
