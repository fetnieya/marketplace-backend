-- Requête SQL pour créer le vendeur Youssef Ghrir
-- Mot de passe: 12345678
-- Date: 2026

INSERT INTO `user` (
    `firstName`,
    `lastName`,
    `email`,
    `password`,
    `role`,
    `createdAt`,
    `updatedAt`
) VALUES (
    'Youssef',
    'Ghrir',
    'youssef.ghrir@example.com',
    '$2b$10$IpyX/0Gdq0x82uXk4VrjteOt9Pw3Xs9dfLWdXfCgyT6SDK7oXsShO',
    'seller',
    NOW(),
    NOW()
);

-- Note: Vous pouvez modifier l'email si nécessaire
-- Le mot de passe est hashé avec bcrypt (salt rounds: 10)
