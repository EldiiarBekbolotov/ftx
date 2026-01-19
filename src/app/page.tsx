"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { useDevMode } from "@/components/DevMode"

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isDevMode, setGameId, setCurrentStep } = useDevMode()
  const [gameCode, setGameCode] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setCurrentStep(0)
  }, [setCurrentStep])

  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      setGameCode(code.toUpperCase().trim())
    }
  }, [searchParams])

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  const createGame = async () => {
    setIsCreating(true)
    setError("")
    try {
      const code = generateCode()
      const { data, error: dbError } = await supabase
        .from("games")
        .insert({ code, status: "waiting" })
        .select()
        .single()

      if (dbError) throw dbError

      // In dev mode, create bot players
      if (isDevMode && data) {
        const botNames = [
          "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry",
          "Ivy", "Jack", "Kate", "Liam", "Mia", "Noah", "Olivia", "Paul",
          "Quinn", "Rachel", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xavier"
        ]
        
        const botsToCreate = Math.min(15, botNames.length)
        const botPlayers = []
        
        for (let i = 0; i < botsToCreate; i++) {
          botPlayers.push({
            game_id: data.id,
            name: botNames[i],
            role: "customer",
            balance: 100
          })
        }

        await supabase.from("players").insert(botPlayers)
      }

      setGameId(data.id)
      setCurrentStep(1)
      router.push(`/host/${data.id}`)
    } catch {
      setError("Failed to create game")
    } finally {
      setIsCreating(false)
    }
  }

  const joinGame = async () => {
    const cleanCode = gameCode.trim().toUpperCase()
    if (!cleanCode || !playerName.trim()) {
      setError("Enter game code and your name")
      return
    }
    setIsJoining(true)
    setError("")
    try {
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select()
        .eq("code", cleanCode)
        .single()

      if (gameError || !game) {
        setError("Game not found")
        return
      }

      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          game_id: game.id,
          name: playerName.trim(),
          role: "customer",
          balance: 100
        })
        .select()
        .single()

      if (playerError) throw playerError
      
      localStorage.setItem("playerId", player.id)
      router.push(`/play/${game.id}`)
    } catch {
      setError("Failed to join game")
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-bold neon-text-green mb-6 tracking-tight">
          FTT-al Flaw
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          A simulation of how FTX collapsed. Experience the bank run in real-time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="crypto-card rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-center">Join a Game</h2>
          <Input
            placeholder="Enter game code (e.g. ABC123)"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            className="bg-background/50 border-white/10 text-center text-2xl tracking-widest font-mono uppercase"
            maxLength={6}
          />
          <Input
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="bg-background/50 border-white/10"
          />
          <Button
            onClick={joinGame}
            disabled={isJoining}
            className="w-full bg-[#00ff88] hover:bg-[#00dd77] text-black font-semibold h-12"
          >
            {isJoining ? "Joining..." : "JOIN GAME"}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-muted-foreground text-sm">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <Button
          onClick={createGame}
          disabled={isCreating}
          variant="outline"
          className="w-full h-12 border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 hover:text-[#00d4ff] cursor-pointer"
        >
          {isCreating ? "Creating..." : "HOST NEW GAME"}
        </Button>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-destructive text-sm"
          >
            {error}
          </motion.p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-12 text-center text-muted-foreground text-sm"
      >
        <p>For 20-30 players • 5-minute experience</p>
        <p className="mt-2">Programmed by Eldiiar Bekbolotov</p>
      </motion.div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen grid-bg flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
