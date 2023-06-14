#!/bin/bash


time 
s=$(date +%s.%3N)
sleep 0.3
e=$(date +%s.%3N)
now=$(date)
echo s
# echo $(( e-s ))
# echo -n $(echo "scale=3;($e-$s)/1000" | bc | awk '{printf "%.3f s\n", $0}')
# echo -n $(echo "($e-$s)" | bc | awk '{printf "%.3f s\n", $0}')
echo ""