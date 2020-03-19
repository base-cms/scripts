#!/bin/bash

echo -e "Restoring indm_all over indm_multi..."
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "mongodump --archive --db=indm_all_configuration | mongorestore --archive --nsFrom='indm_all_configuration.*' --nsTo='indm_multi_configuration.*' --drop"
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "mongodump --archive --db=indm_all_configuration | mongorestore --archive --nsFrom='indm_all_configuration.*' --nsTo='indm_multi_configuration.*' --drop"
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "mongodump --archive --db=indm_all_email | mongorestore --archive --nsFrom='indm_all_email.*' --nsTo='indm_multi_email.*' --drop"
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "mongodump --archive --db=indm_all_magazine | mongorestore --archive --nsFrom='indm_all_magazine.*' --nsTo='indm_multi_magazine.*' --drop"
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "mongodump --archive --db=indm_all_website | mongorestore --archive --nsFrom='indm_all_website.*' --nsTo='indm_multi_website.*' --drop"
ssh -i ~/.ssh/aws ec2-user@10.0.2.50 "mongodump --archive --db=indm_all_platform | mongorestore --archive --nsFrom='indm_all_platform.*' --nsTo='indm_multi_platform.*' --drop"
echo -e "Complete"
