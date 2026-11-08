create database if not exists agricultural_crop_db;

use agricultural_crop_db;

create table if not exists regions (
    region_id int primary key,
    region_name varchar(100) not null unique
);

create table if not exists crops (
    crop_id int primary key,
    crop_name varchar(100) not null unique
);

create table if not exists crop_records (
    record_id int primary key,
    crop_id int not null,
    region_id int not null,
    year int not null,
    cultivated_area decimal(12,2),
    production decimal(12,2),
    rainfall decimal(10,2),
    foreign key (crop_id) references crops(crop_id),
    foreign key (region_id) references regions(region_id)
);
