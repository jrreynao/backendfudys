-- Inserta horarios de trabajo para un restaurante de ejemplo (id=1)
INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(1, 'monday', '09:00:00', '18:00:00'),
(1, 'tuesday', '09:00:00', '18:00:00'),
(1, 'wednesday', '09:00:00', '18:00:00'),
(1, 'thursday', '09:00:00', '18:00:00'),
(1, 'friday', '09:00:00', '18:00:00'),
(1, 'saturday', '10:00:00', '16:00:00'),
(1, 'sunday', '10:00:00', '16:00:00');

-- Puedes duplicar para otros restaurantes cambiando el restaurant_id
