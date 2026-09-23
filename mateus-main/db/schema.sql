-- Criação da tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Newsletter
CREATE TABLE IF NOT EXISTS newsletter (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT NOW()
);

-- Adoções
CREATE TABLE IF NOT EXISTS adoptions (
    id SERIAL PRIMARY KEY,
    pet_name VARCHAR(100) NOT NULL,
    pet_type VARCHAR(50) NOT NULL,
    adopter_name VARCHAR(100) NOT NULL,
    adopter_email VARCHAR(150) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Relatórios de animais perdidos/encontrados
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL, -- perdido ou encontrado
    pet_name VARCHAR(100),
    description TEXT NOT NULL,
    contact VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Parceiros (ONGs, clínicas, etc.)
CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    service VARCHAR(150) NOT NULL,
    contact VARCHAR(150),
    created_at TIMESTAMP DEFAULT NOW()
);