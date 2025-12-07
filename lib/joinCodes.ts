import { createClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';

type JoinRole = 'admin' | 'staff';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_LENGTH = 6;

const getService = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key is required for join codes.');
  }
  return createClient(url, key);
};

const generateCode = () => {
  const num = Math.floor(Math.random() * 1_000_000);
  return num.toString().padStart(CODE_LENGTH, '0');
};

const expireExpired = async (storeId: string, role: JoinRole) => {
  const supabase = getService();
  const { error } = await supabase
    .from('store_join_codes')
    .update({ status: 'expired' })
    .eq('store_id', storeId)
    .eq('role', role)
    .eq('status', 'active')
    .lte('expires_at', new Date().toISOString());
  if (error) throw formatTableError(error);
};

export const getActiveCode = async (storeId: string, role: JoinRole) => {
  await expireExpired(storeId, role);
  const supabase = getService();
  const { data, error } = await supabase
    .from('store_join_codes')
    .select('*')
    .eq('store_id', storeId)
    .eq('role', role)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw formatTableError(error);
  return data?.[0] || null;
};

export const createJoinCode = async ({
  storeId,
  role,
  createdBy,
}: { storeId: string; role: JoinRole; createdBy?: string }) => {
  const supabase = getService();
  await expireExpired(storeId, role);

  // Expire existing active codes for this store/role
  const { error: expireError } = await supabase
    .from('store_join_codes')
    .update({ status: 'expired' })
    .eq('store_id', storeId)
    .eq('role', role)
    .eq('status', 'active');
  if (expireError) throw formatTableError(expireError);

  // Generate unique code
  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const { data: collision, error } = await supabase
      .from('store_join_codes')
      .select('id')
      .eq('code', code)
      .limit(1);
    if (error) throw formatTableError(error);
    if (!collision || collision.length === 0) break;
    code = generateCode();
  }

  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from('store_join_codes')
    .insert({
      store_id: storeId,
      role,
      code,
      status: 'active',
      expires_at: expiresAt,
      created_by: createdBy || null,
    })
    .select()
    .single();

  if (error) throw formatTableError(error);
  return data;
};

export const verifyJoinCode = async ({
  storeId,
  role,
  code,
}: { storeId: string; role: JoinRole; code: string }) => {
  await expireExpired(storeId, role);
  const supabase = getService();
  const { data, error } = await supabase
    .from('store_join_codes')
    .select('*')
    .eq('store_id', storeId)
    .eq('role', role)
    .eq('code', code.trim())
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (error) throw formatTableError(error);
  return data?.[0] || null;
};

export const consumeJoinCode = async ({
  id,
  userId,
}: { id: string; userId?: string }) => {
  const supabase = getService();
  const { data, error } = await supabase
    .from('store_join_codes')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_by: userId || null,
    })
    .eq('id', id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .select()
    .single();

  if (error) throw formatTableError(error);
  return data || null;
};

const formatTableError = (error: PostgrestError) => {
  if (error.code === '42P01') {
    return new Error('store_join_codes table is missing. Run migration 003_store_join_codes.sql in Supabase.');
  }
  return error;
};
