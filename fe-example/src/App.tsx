import React, { useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { DAppProvider, useAccountPkh, useConnect, useOnBlock, useReady, useTezos, useWallet } from './dapp/dapp';
import {APP_NAME, NETWORK, RAFFLE_ADDRESS} from './dapp/defaults'
import { BigMapAbstraction } from '@taquito/taquito';
import { setTokenSourceMapRange } from 'typescript';

type RaffleStorage = {
  admin: string;
  close_date: string;
  description: string;
  jackpot: number;
  players: [string];
  raffle_is_open: boolean;
  sold_tickets: BigMapAbstraction;
  winning_ticket_number_hash: string;
}


const Page = (props: {children: string | number | boolean | {} | React.ReactElement<any, string | React.JSXElementConstructor<any>> | React.ReactNodeArray | React.ReactPortal | null | undefined ; }) => {
  return <div className="App"> {props.children} </div>
}

function ConnectionButton() {
  const connect = useConnect()
  const handleConnect = React.useCallback(async () => {
    try {
      await connect(NETWORK, {forPermission: true})
    } catch (err: any) {
      console.error(err['message'])
    }
  }, [connect])
  return <button onClick={handleConnect}>Connect Account</button>
}

function ConnectionSection() {
  const connect = useConnect()
  const accountPkh = useAccountPkh()
  const tezos = useTezos()
  const [balance, setBalance] = React.useState(null)
  const handleConnect = React.useCallback(async () => {
    try {
      await connect(NETWORK, {forcePermission: true})
    } catch (err: any) {
      console.error(err.message)
    }
  }, [connect])

  const accountPkhPreview = React.useMemo(() => {
    if(!accountPkh) return undefined;
    else {
      const accPkh = (accountPkh as unknown) as string
      const ln = accPkh.length
      return `${accPkh.slice(0,7)}...${accPkh.slice(ln-4, ln)}`
    }
  }, [accountPkh])

  const loadBalance = React.useCallback(async () => {
    if(tezos) {
      const tezosOk = tezos as any
      const bal = await tezosOk.tz.getBalance(accountPkh)
      setBalance(tezosOk.format('mutez', 'tz', bal).toString())
    }
  }, [tezos, accountPkh, setBalance])

  React.useEffect(() => {
    loadBalance()
  }, [loadBalance])

  useOnBlock(tezos, loadBalance)

  return <div style={{ display: "grid", gridTemplateColumns: '1fr 1fr 1fr', margin: '0 auto', width: "500px" }}>
      <div>{balance}</div>
      <div>{accountPkhPreview}</div>
      <button onClick={handleConnect}>Connect account</button>
    </div>
}

function RaffleInformation() {
  const tezos = useTezos();
  const ready = useReady();
  const wallet = useWallet();
  const [contract, setContract] = React.useState(undefined);
  const [storage, setStorage] = React.useState<RaffleStorage>();
  const [tickets, setTickets] = React.useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (tezos) {
        const ctr = await (tezos as any).wallet.at(RAFFLE_ADDRESS)
        setContract(ctr);
      }
    })();
  }, [tezos]);

  const loadStorage = React.useCallback(async () => {
    if(contract) {
      const str = await (contract as any).storage();
      const ticket_ids = Array.from(Array(str.players.length).keys())
      const tckts = await str.sold_tickets.getMultipleValues(ticket_ids);
      setStorage(str);
      setTickets([...tckts.valueMap])
    }
  }, [contract]);

  React.useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  useOnBlock(tezos, loadStorage);

  return (
    <div>
      <div>
        Administrator: {!!storage ? storage.admin.toString() : ""}
      </div>
      <div>
        Reward: {!!storage ? storage.jackpot.toString() : ""}
      </div>
      <div>
        Description: {!!storage ? storage.description.toString() : ""}
      </div>
      <div>
        Players:
        <div>
          {!!storage ? storage.players.map((value, index) => {
            return <li key={index}>{value}</li>
          }) : ""}
        </div>
      </div>
      <div>
        Tickets sold:
        <div>
          {tickets.map((value, index) => {
            return <li key={index}>{value[0]} : {value[1]}</li>
          })}
        </div>
      </div>

      <div>
        Closing date: {!!storage ? storage.close_date.toString() : ""}
      </div>
    </div>
  )
}

function App() {
  return (
    <DAppProvider appName={APP_NAME}>
      <React.Suspense fallback={null}>
        <Page>
          {/* <ConnectionButton></ConnectionButton> */}
          <ConnectionSection></ConnectionSection>
          <RaffleInformation></RaffleInformation>
        </Page>
      </React.Suspense>
    </DAppProvider>
  );
}

export default App;
