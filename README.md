# Introduction
crosschainsdk is an application framework for interacting with the CrossBridge contracts without Solidity knowledge.

Under the hood, crosschainsdk leverages TypeScript, ethers.js.

### CrossBridge Contract Address
```
Goerli: 0xf20120837f252a0E2a169A90875f35b267e4187a
Hobby: 0x1AEB25f3F483D5701e205dB708dA68c7Ed6870c3
```

### Simulate existed tokens for testing
```
Goerli USDT: 0x0a69c81896a92b7a46f1Ca1F13E4b08DDC4a0656
Goerli WETH: 0xEbE1096de0AA365a4148046449D70aBe97D62E8C
Hobby WSBY: 0x310ca9f33c8b897a75C58620c224e32609F2D737
```

# Environment dependencies

Only depends on the library ethers

## Install ethers

```bash
npm install ethers
```

# Examples using CrossBridge class

## examples for back-end

### listen goerli cross to hobby bridge and hobyy cross to goerli bridgeback

```typescript
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();
import { CrossBridge, CrossBridge__factory, ERC20, ERC20__factory } from "../src";
import { ITokenFactory } from "../src/CrossBridge";
import * as utils from "./utils";


async function main() {
    
    const [goerliCrossBridgeAddress, hobbyCrossBridgeAddress] = utils.readCrossBridgeAddress();
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);

    const goerliProvider = new ethers.providers.InfuraProvider("goerli", process.env.INFURA_API_KEY);
    const goerliWallet = wallet.connect(goerliProvider);
    const hobbyProvider = new ethers.providers.JsonRpcProvider("http://103.39.218.177:8545", 9001);
    const hobbyWallet = wallet.connect(hobbyProvider);

    const goerliCrossBridge = CrossBridge__factory.connect(goerliCrossBridgeAddress, goerliWallet);
    const hobbyCrossBridge = CrossBridge__factory.connect(hobbyCrossBridgeAddress, hobbyWallet);

    // The relay monitors the goerli network for cross-chain bridge events
    goerliCrossBridge.on("TokensBridged", async (transferID, tokenType) => {
        const tokenTransfer = await goerliCrossBridge.tokenTransfers(transferID);
        const bridgeAmount = tokenTransfer.amount;
        const to = tokenTransfer.tokenTransfer.dstAddress;
        const srcTokenAddress = tokenTransfer.tokenTransfer.tokenAddress;
        const srcChianId = tokenTransfer.tokenTransfer.srcChain;
        const isWrappedTokenSupported = await hobbyCrossBridge.isWrappedTokenSupported(srcTokenAddress, srcChianId);

        const srcToken = ERC20__factory.connect(srcTokenAddress, goerliProvider);
        const srcTokenDecimals = await srcToken.decimals();
        const srcTokenSymbol = await srcToken.symbol();
        const srcTokenName = await srcToken.name();

        let wrappedTokenAddress: string;
        if (isWrappedTokenSupported == false) {
            const zeroAddress = "0x0000000000000000000000000000000000000000";
            const attestation: ITokenFactory.TokenAttestationStruct = {
                tokenAddress: srcTokenAddress,
                tokenChain: srcChianId,
                tokenType: tokenType,
                decimals: srcTokenDecimals,
                symbol: srcTokenSymbol,
                name: srcTokenName,
                wrappedTokenAddress: zeroAddress
            }
            const attestTokenTX = await hobbyCrossBridge.attestToken(attestation);
            await attestTokenTX.wait();
            wrappedTokenAddress = await hobbyCrossBridge.getWrappedToken(srcTokenAddress, srcChianId);
            if (wrappedTokenAddress === zeroAddress) {
                throw new Error('create mapping token fail');
            }
            console.log("wrappedTokenAddress:   ", wrappedTokenAddress);
            const addDeployedTokenTX = await goerliCrossBridge.addDeployedToken(srcTokenAddress);
            await addDeployedTokenTX.wait();
        }

        const attestationID = ethers.utils.solidityKeccak256(['address', 'uint256'], [srcTokenAddress, srcChianId]);
        const releaseWrappedTokensTX = await hobbyCrossBridge.releaseWrappedTokens(bridgeAmount, to, attestationID);
        await releaseWrappedTokensTX.wait();
    });

    // The relay monitors the hobby network for cross-chain bridge return events
    hobbyCrossBridge.on("TokensBridgedBack", async (amount, to, attestationID, convertToNative) => {
        const [tokenAddress] = await hobbyCrossBridge.attestedTokens(attestationID);

        const releaseTokensTX = await goerliCrossBridge.releaseTokens(amount, to, tokenAddress, convertToNative);
        await releaseTokensTX.wait();
    });
}
```

## examples for front-end

### bridgeTokens example

```typescript
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();
import { CrossBridge, CrossBridge__factory, ERC20, ERC20__factory } from "../src";
import * as utils from "./utils";


async function main() {
    
    const [goerliCrossBridgeAddress, hobbyCrossBridgeAddress] = utils.readCrossBridgeAddress();
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);

    const goerliProvider = new ethers.providers.InfuraProvider("goerli", process.env.INFURA_API_KEY);
    const goerliWallet = wallet.connect(goerliProvider);
    const hobbyProvider = new ethers.providers.JsonRpcProvider("http://103.39.218.177:8545", 9001);
    const hobbyWallet = wallet.connect(hobbyProvider);

    const goerliCrossBridge = CrossBridge__factory.connect(goerliCrossBridgeAddress, goerliWallet);
    const hobbyCrossBridge = CrossBridge__factory.connect(hobbyCrossBridgeAddress, hobbyWallet);

    const goerliUsdtAddress = utils.readGoerliUsdtAddress();
    const bridgeAmount = ethers.utils.parseUnits('100', 6n);

    const usdtToken = ERC20__factory.connect(goerliUsdtAddress, goerliWallet);
    const approveTX = await usdtToken.approve(goerliCrossBridge.address, bridgeAmount);
    await approveTX.wait();

    const bridgeTokensTX = await goerliCrossBridge.bridgeTokens(
        goerliUsdtAddress,
        bridgeAmount,
        9001n,
        wallet.address
    );
    await bridgeTokensTX.wait();
}
```

### bridgeTokensBack example

```typescript
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();
import { CrossBridge, CrossBridge__factory, ERC20, ERC20__factory } from "../src";
import * as utils from "./utils";


async function main() {
    
    const [goerliCrossBridgeAddress, hobbyCrossBridgeAddress] = utils.readCrossBridgeAddress();
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);

    const goerliProvider = new ethers.providers.InfuraProvider("goerli", process.env.INFURA_API_KEY);
    const goerliWallet = wallet.connect(goerliProvider);
    const hobbyProvider = new ethers.providers.JsonRpcProvider("http://103.39.218.177:8545", 9001);
    const hobbyWallet = wallet.connect(hobbyProvider);

    const goerliCrossBridge = CrossBridge__factory.connect(goerliCrossBridgeAddress, goerliWallet);
    const hobbyCrossBridge = CrossBridge__factory.connect(hobbyCrossBridgeAddress, hobbyWallet);

    const tokenInfos = await hobbyCrossBridge.getSupportedTokens();
    let hobbyWrappedTokenAddress: string | undefined;
    for (let tokenInfo of tokenInfos) {
        if (tokenInfo.isWrapped === true) {
            hobbyWrappedTokenAddress = tokenInfo.token;
        }
    }
    if (hobbyWrappedTokenAddress === undefined) {
        return;
    }
    const hobbyWrappedToken = ERC20__factory.connect(hobbyWrappedTokenAddress, hobbyProvider);
    const decimals = await hobbyWrappedToken.decimals();
    const bridgeBackAmount = ethers.utils.parseUnits('100',  decimals);

    const [goerliTokenAddress, goerliChainid] = await hobbyCrossBridge.getDeployedToken(hobbyWrappedTokenAddress);
    const attestationID = ethers.utils.solidityKeccak256(['address', 'uint256'], [goerliTokenAddress, goerliChainid]);
    const bridgeTokensBackTX = await hobbyCrossBridge.bridgeTokensBack(
        bridgeBackAmount,
        wallet.address,
        attestationID,
        false
    );
    await bridgeTokensBackTX.wait();
}
```
