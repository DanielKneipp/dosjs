# Distributed Optimization System - Js

Simple peer-to-peer node application that distributes a request of an execution command and presents the lowest result to the user.

For more about this system and a use case example, please see doc/Report.pdf (it's in brazilian portuguese)

## Commands

- `printServers`: List all instances that this instance is connected to
- `printClients`: List all instances that are connected to this instance
- `connect`: Connect to all instances with the IPs specified in `otherHosts.txt`
- `getResult`: Retrieve the best optimization result (lower) on the cluster
- `reset`: Reset the cluster to the initial state (ready for a new execution)
- `exit`: Exit the system

## Author

- Daniel Kneipp de Sá Viera (daniel.kneipp *at* outlook *dot* com)
