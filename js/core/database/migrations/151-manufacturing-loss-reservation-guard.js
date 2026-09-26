'use strict';
module.exports={id:'151-manufacturing-loss-reservation-guard',up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_manufacturing_loss_respects_reservations
BEFORE INSERT ON inventory_movements
WHEN NEW.source_type='manufacturing-loss' AND NEW.delta_qty<0
BEGIN
 SELECT CASE WHEN (
  COALESCE((SELECT SUM(delta_qty) FROM inventory_movements WHERE product_id=NEW.product_id AND location_id=NEW.location_id),0)
  + NEW.delta_qty
 ) < COALESCE((
  SELECT SUM(quantity-consumed_quantity)
  FROM inventory_reservations
  WHERE product_id=NEW.product_id AND location_id=NEW.location_id AND status='ACTIVE'
 ),0)
 THEN RAISE(ABORT,'Estoque indisponivel: quantidade reservada para outras demandas.') END;
END;
`);}};
