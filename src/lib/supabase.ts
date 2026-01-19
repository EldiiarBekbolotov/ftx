import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Game = {
  id: string
  code: string
  status: 'waiting' | 'playing' | 'paused' | 'ended'
  phase: number
  started_at: string | null
  paused_at: string | null
  total_vault_display: number
  actual_vault: number
  created_at: string
}

export type Player = {
  id: string
  game_id: string
  name: string
  role: 'customer' | 'ftx' | 'alameda' | 'observer'
  balance: number
  has_withdrawn: boolean
  withdrawn_amount: number
  created_at: string
}

export type GameEvent = {
  id: string
  game_id: string
  event_type: string
  message: string
  created_at: string
}
