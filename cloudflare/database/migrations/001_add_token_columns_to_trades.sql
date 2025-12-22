-- =============================================
-- Migration: Add TokenSent and TokenReceived columns to Trades table
-- Date: 2025-12-16
-- Description:
--   Adds TokenSent and TokenReceived columns to clarify which tokens
--   were exchanged in a trade, alongside the existing QuantitySent
--   and QuantityReceived columns.
-- =============================================

-- Add TokenSent column (references Tokens.TokenID)
ALTER TABLE Trades ADD COLUMN TokenSent INTEGER REFERENCES Tokens(TokenID);

-- Add TokenReceived column (references Tokens.TokenID)
ALTER TABLE Trades ADD COLUMN TokenReceived INTEGER REFERENCES Tokens(TokenID);

-- Create indexes for the new columns to improve query performance
CREATE INDEX IF NOT EXISTS IX_Trades_TokenSent ON Trades(TokenSent);
CREATE INDEX IF NOT EXISTS IX_Trades_TokenReceived ON Trades(TokenReceived);

-- =============================================
-- Migration Notes:
-- =============================================
--
-- Before this migration:
--   - QuantitySent and QuantityReceived had the same value (incorrect)
--   - No way to determine which tokens were involved in the trade
--
-- After this migration:
--   - TokenSent: The token ID that was sold/sent in the trade
--   - TokenReceived: The token ID that was bought/received in the trade
--   - QuantitySent: The actual quantity of TokenSent that was sold
--   - QuantityReceived: The actual quantity of TokenReceived that was received
--
-- Examples:
--   SELL 1 ETH for 3000 USDC:
--     - Action: SELL
--     - TokenSent: <ETH TokenID>
--     - TokenReceived: <USDC TokenID>
--     - QuantitySent: 1.0
--     - QuantityReceived: 3000.0
--
--   BUY 1 ETH with 3000 USDC:
--     - Action: BUY
--     - TokenSent: <USDC TokenID>
--     - TokenReceived: <ETH TokenID>
--     - QuantitySent: 3000.0
--     - QuantityReceived: 1.0
--
-- =============================================
