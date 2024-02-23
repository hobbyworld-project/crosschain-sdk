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


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});