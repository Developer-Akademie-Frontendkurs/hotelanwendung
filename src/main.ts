import './style.css';
import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line prettier/prettier
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_API_KEY,
);

const router = async () => {
    const routes = [
        { path: '/', view: Home }
    ];
}
