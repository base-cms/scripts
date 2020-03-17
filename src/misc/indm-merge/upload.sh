#!/bin/bash

echo -e "\nExporting mongo data..."
rm -rf dump indm_multi.tar.gz
docker-compose exec -w /scripts mongodb mongodump -d indm_multi_configuration
docker-compose exec -w /scripts mongodb mongodump -d indm_multi_email
docker-compose exec -w /scripts mongodb mongodump -d indm_multi_magazine
docker-compose exec -w /scripts mongodb mongodump -d indm_multi_platform
docker-compose exec -w /scripts mongodb mongodump -d indm_multi_website

echo -e "\nCompressing mongo data..."
tar -zvcf indm_multi.tar.gz dump/

echo -e "\nUploading mongo data..."
rsync -e 'ssh -i ~/.ssh/aws' indm_multi.tar.gz ec2-user@10.0.2.50:/home/ec2-user/indm_multi.tar.gz --progress

# echo -e "\nImporting mongo data..."
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "rm -rf dump; tar -xzf indm_multi.tar.gz; mongorestore --drop"
