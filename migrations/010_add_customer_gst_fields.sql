-- Add GSTIN and State to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS gstin TEXT,
ADD COLUMN IF NOT EXISTS state TEXT;

COMMENT ON COLUMN customers.gstin IS 'GST Identification Number';
COMMENT ON COLUMN customers.state IS 'State for Place of Supply (IGST vs CGST/SGST)';
