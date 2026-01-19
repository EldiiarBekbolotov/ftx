"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

type DevModeContextType = {
  isDevMode: boolean
  setIsDevMode: (value: boolean) => void
  currentStep: number
  setCurrentStep: (step: number) => void
  gameId: string | null
  setGameId: (id: string | null) => void
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined)

export function useDevMode() {
  const context = useContext(DevModeContext)
  if (!context) {
    throw new Error("useDevMode must be used within DevModeProvider")
  }
  return context
}

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [gameId, setGameId] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "u") {
        e.preventDefault()
        setIsDevMode((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <DevModeContext.Provider
      value={{
        isDevMode,
        setIsDevMode,
        currentStep,
        setCurrentStep,
        gameId,
        setGameId,
      }}
    >
      {children}
      <DevModePanel />
    </DevModeContext.Provider>
  )
}

function DevModePanel() {
  const { isDevMode, currentStep, setCurrentStep, gameId, setGameId } = useDevMode()
  const router = useRouter()
  const pathname = usePathname()

  const steps = [
    { name: "Home", path: "/" },
    { name: "Host Waiting", path: gameId ? `/host/${gameId}` : null },
    { name: "Host Playing", path: gameId ? `/host/${gameId}` : null },
    { name: "Player View", path: gameId ? `/play/${gameId}` : null },
    { name: "Game End", path: gameId ? `/host/${gameId}` : null },
  ]

  // Sync step with current route
  useEffect(() => {
    if (!gameId) {
      if (pathname === "/") {
        setCurrentStep(0)
      }
      return
    }

    if (pathname === `/host/${gameId}`) {
      // We'll let the host page determine the step based on game status
      return
    } else if (pathname === `/play/${gameId}`) {
      setCurrentStep(3)
    } else if (pathname === "/") {
      setCurrentStep(0)
    }
  }, [pathname, gameId, setCurrentStep])

  const goToStep = async (step: number) => {
    if (step < 0 || step >= steps.length) return

    const targetStep = steps[step]
    if (!targetStep.path) return

    // Allow going to home without gameId
    if (step === 0) {
      setCurrentStep(0)
      router.push("/")
      return
    }

    // For other steps, we need a gameId
    if (!gameId) return

    // Handle state transitions
    try {
      if (step === 2) {
        // Going to "Host Playing" - start the game
        const { data: game } = await supabase
          .from("games")
          .select()
          .eq("id", gameId)
          .single()
        
        if (game && game.status === "waiting") {
          await supabase
            .from("games")
            .update({ status: "playing", started_at: new Date().toISOString() })
            .eq("id", gameId)
          await supabase
            .from("game_events")
            .insert({ game_id: gameId, event_type: "game_start", message: "Game has started!" })
        }
      } else if (step === 3) {
        // Going to "Player View" - ensure a player exists
        const playerId = localStorage.getItem("playerId")
        if (!playerId) {
          // Create a dev player
          const { data: player } = await supabase
            .from("players")
            .insert({
              game_id: gameId,
              name: "Dev Player",
              role: "customer",
              balance: 100
            })
            .select()
            .single()
          
          if (player) {
            localStorage.setItem("playerId", player.id)
          }
        }
      } else if (step === 4) {
        // Going to "Game End" - end the game
        const { data: game } = await supabase
          .from("games")
          .select()
          .eq("id", gameId)
          .single()
        
        if (game && game.status !== "ended") {
          await supabase
            .from("games")
            .update({ status: "ended", total_vault_display: 0, actual_vault: 0 })
            .eq("id", gameId)
          await supabase
            .from("game_events")
            .insert({ game_id: gameId, event_type: "game_end", message: "FTX has filed for bankruptcy." })
        }
      }
    } catch (error) {
      console.error("Error transitioning step:", error)
    }

    setCurrentStep(step)
    router.push(targetStep.path)
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1)
    }
  }

  if (!isDevMode) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="fixed top-4 right-4 z-50 crypto-card rounded-xl p-4 min-w-[280px]"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-sm font-semibold">DEV MODE</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>
        </div>

        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">Current Step:</p>
          <p className="text-sm font-medium">{steps[currentStep]?.name || "Unknown"}</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handlePrev}
            disabled={currentStep === 0}
            variant="outline"
            size="sm"
            className="flex-1 border-white/20 text-white hover:bg-white/10"
          >
            ← Prev
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentStep === steps.length - 1}
            variant="outline"
            size="sm"
            className="flex-1 border-white/20 text-white hover:bg-white/10"
          >
            Next →
          </Button>
        </div>

        {gameId && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Game: {gameId.slice(0, 8)}...
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
