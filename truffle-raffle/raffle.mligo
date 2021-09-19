type storage = {
    admin: address;
    close_date: timestamp;
    jackpot: tez;
    description: string;
    raffle_is_open: bool;
    players: address set;
    sold_tickets: (nat, address) big_map;
    winning_ticket_number_hash: bytes;
}

type openRaffleParameter = tez * timestamp * string option * bytes
type buyTicketParameter = unit
type closeRaffleParameter = nat

type raffleEntrypoints = 
 | OpenRaffle of openRaffleParameter
 | BuyTicket of buyTicketParameter
 | CloseRaffle of closeRaffleParameter

type returnType = operation list * storage

let openRaffle (jackpot_amount: tez)(close_date: timestamp)(description: string option)(winning_ticket_number_hash: bytes)(store: storage): returnType = 
    if Tezos.source <> store.admin 
        then (failwith "administrator not recognized":returnType)
    else 
        if  store.raffle_is_open = false 
            then if Tezos.amount < jackpot_amount 
                then (failwith "The administrator does not own enough tez.":returnType)
            else 
                let today: timestamp = Tezos.now in
                let seven_day: int = 7 * 86400 in
                let in_7_day: timestamp = (today + seven_day) in
                let is_close_date_not_valid: bool = (close_date < in_7_day) in
                if is_close_date_not_valid
                then (failwith "The raffle must ramain open for at least 7 days.":returnType)
                else 
                    let newStore = { store with 
                    jackpot = jackpot_amount;
                    close_date = close_date;
                    raffle_is_open = true;
                    winning_ticket_number_hash = winning_ticket_number_hash;
                    } in
                    match description with 
                        | Some(d) -> (([]: operation list) , { newStore with description = d})
                        | None -> ( ([]:operation list) , newStore )
            
        else
            (failwith "A raffle is open.": returnType)

let buyTicket (_param: unit)(store: storage): returnType = 
    if store.raffle_is_open then 
        let ticket_price: tez = 1tez in
        let current_player: address = Tezos.sender in
        if Tezos.amount = ticket_price
        then (failwith "The sender does not own enough tz to buy a ticket.": returnType)
        else
            if Set.mem (current_player) store.players 
            then (failwith "Each player can participate only once": returnType)
            else
                let ticket_id: nat = Set.size store.players in 
                let newStore = { store with
                    players = Set.add current_player store.players;
                    sold_tickets = Big_map.add ticket_id current_player store.sold_tickets
                } in
                (([]: operation list), newStore)
                
    else (failwith "The raffle is closed.": returnType)

let closeRaffle (winning_ticket_number: nat)(store: storage): returnType = 
    if Tezos.source <> store.admin
    then (failwith "Adminstrator not recognized": returnType)
    else
        if store.raffle_is_open 
        then if Tezos.now < store.close_date 
            then (failwith "The raffle must remain open for at least 7 days.": returnType)
            else
                let winning_ticket_number_bytes: bytes = Bytes.pack winning_ticket_number in
                let winning_ticket_number_hash: bytes = Crypto.sha256 winning_ticket_number_bytes in
                if winning_ticket_number_hash <> store.winning_ticket_number_hash
                then (failwith "the hash does not match the hash of the winning ticket.": returnType)
                else 
                    let number_of_players: nat = Set.size(store.players) in
                    let winning_ticket_id: nat = winning_ticket_number mod number_of_players in 
                    let w = (Big_map.find_opt winning_ticket_id store.sold_tickets) in
                    let winner = (match w with
                        | Some(a) -> a
                        | None -> (failwith "Winner address not found": address)
                    )in
                    let receiver: unit contract =
                    (match (Tezos.get_contract_opt winner: (unit contract) option) with
                        | Some(c) -> c
                        | None -> (failwith "Winner contract not found.": unit contract)
                    )
                        in
                    let op: operation = Tezos.transaction unit store.jackpot receiver in
                    let operations: operation list = [op] in
                    let newStore = { store with
                    jackpot = 0tez;
                    close_date = (0: timestamp);
                    description = ("raffle is currently closed": string);
                    raffle_is_open = false;
                    players = (Set.empty: address set);
                    sold_tickets = (Big_map.empty: (nat, address) big_map)
                    } in
                    ( (operations) , newStore )
        else
            (failwith "The raffle is closed.": returnType)

let main (action , storage : raffleEntrypoints * storage): returnType =
    match action with 
    | OpenRaffle (param) -> openRaffle param.0 param.1 param.2 param.3 storage
    | BuyTicket (param) -> buyTicket param storage
    | CloseRaffle(param) -> closeRaffle param storage
    //((nil: list(operation)), store)