import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nwvqjmgiwyhcvmkoluxl.supabase.co'
const supabaseKey = 'sb_publishable_uFjZTD0gUZNN6gUrpqpcYQ_uxqwbEQK'

export const supabase = createClient(supabaseUrl, supabaseKey)