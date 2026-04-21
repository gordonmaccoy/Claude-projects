-- Enable Row Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- restaurants: anonymous and authenticated users can read live rows
CREATE POLICY "Public read live restaurants"
  ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live');

-- restaurants: service_role has unrestricted access
CREATE POLICY "Service role full access on restaurants"
  ON restaurants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- submissions: anyone can insert (the public suggest-a-spot form)
CREATE POLICY "Anyone can submit a suggestion"
  ON submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- submissions: service_role has unrestricted access (curator review)
CREATE POLICY "Service role full access on submissions"
  ON submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
