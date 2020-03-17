#!/bin/bash

echo "Exporting mongo data..."
mkdir -p ~/Downloads/indm
(cd ~/Downloads/indm;
  mongodump --host rs01.caprica.baseplatform.io -d icarus;
  mongodump --host rs01.caprica.baseplatform.io -d platform;
  mongodump --host rs01.caprica.baseplatform.io -d indm_all_configuration;
  mongodump --host rs01.caprica.baseplatform.io -d indm_all_email;
  mongodump --host rs01.caprica.baseplatform.io -d indm_all_magazine;
  mongodump --host rs01.caprica.baseplatform.io -d indm_all_platform;
  mongodump --host rs01.caprica.baseplatform.io -d indm_all_website;
  mongodump --host rs01.caprica.baseplatform.io -d indm_cen_configuration;
  mongodump --host rs01.caprica.baseplatform.io -d indm_cen_email;
  mongodump --host rs01.caprica.baseplatform.io -d indm_cen_magazine;
  mongodump --host rs01.caprica.baseplatform.io -d indm_cen_platform;
  mongodump --host rs01.caprica.baseplatform.io -d indm_cen_website;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ddt_configuration;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ddt_email;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ddt_magazine;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ddt_platform;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ddt_website;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ien_configuration;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ien_email;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ien_magazine;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ien_platform;
  mongodump --host rs01.caprica.baseplatform.io -d indm_ien_website;
)

echo "Restoring mongo data..."
(cd ~/Downloads/indm; mongorestore --host=localhost:10020 --drop)
