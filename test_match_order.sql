-- Replace 'ORDER_UUID' with the actual order ID from the app console logs
UPDATE orders 
SET 
  status = 'accepted', 
  partner_id = (SELECT id FROM partners LIMIT 1) -- Assigns the first available partner
WHERE id = 'ORDER_UUID';
