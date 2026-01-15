import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gtzptnpbfmnhmktfqboi.supabase.co'
const supabaseKey = 'sb_publishable_YwR-LjwqbNNYK30V43jQiA_sHpStOIO'

export const supabase = createClient(supabaseUrl, supabaseKey)
