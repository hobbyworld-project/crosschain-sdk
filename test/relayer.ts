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


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
