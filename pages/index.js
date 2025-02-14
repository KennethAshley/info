import { useEffect, useState } from "react";
import Big from "big.js";
import Head from "next/head";
import axios from "axios";
import styled from "@emotion/styled";
import Image from "next/image";
import { Flex, Box, Text } from "rebass";
import { keyframes } from "@emotion/react";
import { whitelist } from "@state/whitelist";
import { formatCurrency } from "../utils";
import { PageWrapper } from "../shared/styles";
import Header from "../components/Header";
import PairTable from "../components/PairTable";
import TokenTable from "../components/TokenTable";
import Card from "../components/Card";
import { API_BASE_URL } from "@utils/constants/vexchange";

const LargeText = styled.p`
  font-size: 32px;
  margin: 0;
`;

const SpecialText = styled(Text)`
  font-family: VCR, sans-serif;
  text-transform: uppercase;
`;

const Label = styled.span`
  display: inline-block;
  background-color: #f5a78814;
  color: #f5a788;
  font-family: VCR, sans-serif;
  text-transform: uppercase;
  box-sizing: border-box;
  margin-bottom: 20px;
  min-width: 0px;
  font-size: 12px;
  padding: 8px;
  border-radius: 8px;
`;

const bounce = keyframes`
  from {
    transform: scale(0.5);
  }

  to {
    transform: scale(1);
  }
`;

const HeaderWrapper = styled.div`
  display: flex;
  flex-flow: column nowrap;
  top: 0;
  left: 0;
  width: 100%;
  position: fixed;
  justify-content: space-between;
  z-index: 2;
`;

export default function Home() {
  const [pairs, setPairs] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [tvl, setTVL] = useState(0);
  const [vol, setVol] = useState(0);
  const { whiteListedTokens } = whitelist.useContainer();

  useEffect(() => {
    if (!whiteListedTokens) return;
    const getPairs = async () => {
      const pairsApiResult = await axios(`${API_BASE_URL}pairs`);
      const filtered = Object.values(pairsApiResult.data).filter(pair =>
          whiteListedTokens.has(pair.token0.contractAddress) && whiteListedTokens.has(pair.token1.contractAddress)
      );
      const _pairs = filtered.map((e) => {
        e.totalReserveUsd =
          +e.token0Reserve * e.token0.usdPrice +
          +e.token1Reserve * e.token1.usdPrice;
        e.totalVolumeUsd = +e.token0Volume * e.token0.usdPrice;
        //TODO: Check if we can get APR from API
        const swapFee = parseFloat(e.swapFee) / 100;
        const platformFee = parseFloat(e.platformFee) / 100;
        const lpTakeHome = swapFee * (1 - platformFee);
        const lpFeesPerYear = (
            e.totalVolumeUsd
            * lpTakeHome // Fee generated in a day
            * 365
        );
        e.annualizedFeeApr = lpFeesPerYear / e.totalReserveUsd;

        return e;
      });
      setPairs(_pairs);

      //transform to tokens
      const tokensMap = _pairs.reduce((acc, curr) => {
        const token0 = curr.token0.contractAddress;
        const token1 = curr.token1.contractAddress;
        const reserve0Usd = +curr.token0Reserve * curr.token0.usdPrice;
        const reserve1Usd = +curr.token1Reserve * curr.token1.usdPrice;
        const volume0 = +curr.token0Volume * curr.token0.usdPrice;
        const volume1 = +curr.token1Volume * curr.token1.usdPrice;
        
        return {
          ...acc,
          [token0]: {
            ...curr.token0,
            tvl: (acc[token0]?.tvl ?? 0) + reserve0Usd,
            volume: (acc[token0]?.volume ?? 0) + volume0,
          },
          [token1]: {
            ...curr.token1,
            tvl: (acc[token1]?.tvl ?? 0) + reserve1Usd,
            volume: (acc[token1]?.volume ?? 0) + volume1,
          },
        };
      }, {});
      setTokens(Object.values(tokensMap));
    };
    getPairs();
  }, [whiteListedTokens]);

  useEffect(() => {
    const calculate = () => {
      const stats = pairs.reduce(
        (acc, curr) => {
          return {
            tvl: acc.tvl.plus(Big(curr.totalReserveUsd || 0)),
            vol: acc.vol.plus(Big(curr.totalVolumeUsd || 0)),
          };
        },
        { tvl: new Big(0), vol: new Big(0) }
      );

      setTVL(stats.tvl.toString());
      setVol(stats.vol);
    };

    if (pairs.length !== 0) {
      calculate();
    }
  }, [pairs]);

  return (
    <PageWrapper>
      <Head>
        <title>Vexchange Info</title>
        <meta name="description" content="Vexchange statistics" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔥</text></svg>"
        />
      </Head>
      <HeaderWrapper>
        <Header />
      </HeaderWrapper>
      {pairs.length === 0 ? (
        <Box
          sx={{
            position: "fixed",
            top: "50%",
            left: "50%",
            marginTop: -91.5,
            marginLeft: -100,
            animationName: bounce,
            animationDuration: "1s",
          }}
        >
          <Image alt="loading" height="183" src="/logo.png" width="200" />
        </Box>
      ) : (
        <>
          <SpecialText mb={3}>Vexchange Overview</SpecialText>
          <Flex mx={-3} mb={4} flexDirection={["column", "row"]}>
            <Box flex="1" px={3}>
              <Card>
                <Label>Total Value Locked</Label>
                <LargeText>{formatCurrency(tvl)}</LargeText>
              </Card>
            </Box>
            <Box flex="1" px={3} mt={[3, 0]}>
              <Card>
                <Label>Volume 24H</Label>
                <LargeText>{formatCurrency(vol.toFixed(2))}</LargeText>
              </Card>
            </Box>
          </Flex>

          <SpecialText mb={3}>Tokens</SpecialText>
          <TokenTable tokens={tokens} />

          <SpecialText mb={3}>Top Pairs</SpecialText>
          <PairTable pairs={pairs} />
        </>
      )}
    </PageWrapper>
  );
}
