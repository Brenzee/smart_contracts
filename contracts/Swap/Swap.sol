// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/IUniswapV3Pool.sol";
import "../Interfaces/IWETH.sol";
import "./Swap_Constants.sol";

/** @dev uint256 pool structure */
/*                                                   1-159     160bit poolAddress */
uint256 constant ZERO_FOR_ONE_MASK = 0x01 << 160; // 160-168   8bit zeroForOne
uint256 constant WETH_UNWRAP_MASK = 0x01 << 168; //  168-176   8bit wethUnwrap
//                                                   168-240   72bit emptyBytes
uint256 constant SWAP_PLATFORM = 240; //             240-248   8bit swapPlatform
uint256 constant VERSION_OF_SWAP = 248; //           248-256   8bit versionOfSwap

struct IERC20PermitSignature {
    address token;
    uint8 v;
    bytes32 r;
    bytes32 s;
    uint256 deadline;
}

struct MultiSwap {
    uint256 minReturn;
    uint256 pool;
}

contract Swap {
    using Address for address payable;
    using SafeERC20 for IERC20;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
    uint160 private constant _MIN_SQRT_RATIO = 4295128739 + 1;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 private constant _MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 - 1;
    IWETH private immutable _WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    function swapUniswapV3WithPermit(
        address payable recipient,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools,
        IERC20PermitSignature calldata erc20permit
    ) external payable returns (uint256 returnAmount) {
        uint256 len = pools.length;
        require(len > 0, "Pools are empty");
        uint256 lastIndex = len - 1;
        returnAmount = amount;
        bool unwrapWeth = pools[lastIndex] & WETH_UNWRAP_MASK > 0;

        // Approve this contract to spend the token with signature
        _permitERC20(amount, erc20permit);

        if (len > 1) {
            // First swap is from msg.sender
            returnAmount = _swapV3(address(this), msg.sender, pools[0], returnAmount);

            // All the swaps except the are from this contract
            for (uint256 i = 1; i < lastIndex; i++) {
                returnAmount = _swapV3(address(this), address(this), pools[i], returnAmount);
            }

            // Last swap - send to msg.sender
            returnAmount = _swapV3(
                unwrapWeth ? address(this) : recipient,
                address(this),
                pools[lastIndex],
                returnAmount
            );
        } else {
            // Only one swap
            returnAmount = _swapV3(unwrapWeth ? address(this) : recipient, msg.sender, pools[0], returnAmount);
        }

        require(returnAmount >= minReturn, "Return amount is less than minReturn");
    }

    function swapUniswapV3(
        address payable recipient,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) public payable returns (uint256 returnAmount) {
        uint256 len = pools.length;
        require(len > 0, "Pools are empty");
        uint256 lastIndex = len - 1;
        returnAmount = amount;
        bool wrapWeth = msg.value > 0;
        bool unwrapWeth = pools[lastIndex] & WETH_UNWRAP_MASK > 0;
        if (wrapWeth) {
            require(amount == msg.value, "Amount is not equal to msg.value");
            _WETH.deposit{value: amount}();
        }
        if (len > 1) {
            // First swap is from msg.sender
            returnAmount = _swapV3(address(this), wrapWeth ? address(this) : msg.sender, pools[0], returnAmount);

            // All the swaps except the are from this contract
            for (uint256 i = 1; i < lastIndex; i++) {
                returnAmount = _swapV3(address(this), address(this), pools[i], returnAmount);
            }

            // Last swap - send to msg.sender
            returnAmount = _swapV3(
                unwrapWeth ? address(this) : recipient,
                address(this),
                pools[lastIndex],
                returnAmount
            );
        } else {
            // Only one swap
            returnAmount = _swapV3(
                unwrapWeth ? address(this) : recipient,
                wrapWeth ? address(this) : msg.sender,
                pools[0],
                returnAmount
            );
        }

        require(returnAmount >= minReturn, "Return amount is less than minReturn");
        if (unwrapWeth) {
            _WETH.withdraw(returnAmount);
            recipient.sendValue(returnAmount);
        }
    }

    function multiSwap(
        address recipient,
        uint256 amount,
        MultiSwap[] calldata swaps
    ) public payable returns (uint256 returnAmount) {
        uint256 len = swaps.length;
        uint256 lastIndex = len - 1;
        require(len > 0, "Swaps are empty");

        if (len > 1) {
            // First swap is from msg.sender
            returnAmount = _swapOfMultiswap(address(this), msg.sender, swaps[0], amount);

            // All the swaps except the are from this contract
            for (uint256 i = 1; i < len; i++) {
                returnAmount = _swapOfMultiswap(address(this), address(this), swaps[i], returnAmount);
            }

            // Last swap - send to msg.sender
            returnAmount = _swapV3(recipient, address(this), lastIndex, returnAmount);
        } else {
            // Only one swap
            returnAmount = _swapOfMultiswap(recipient, msg.sender, swaps[0], amount);
        }

        require(returnAmount >= swaps[lastIndex].minReturn, "Return amount is less than minReturn");
    }

    function _swapV3(address recipient, address sender, uint256 pool, uint256 amount) private returns (uint256) {
        address poolAddress = address(uint160(pool));
        bool zeroForOne = pool & ZERO_FOR_ONE_MASK != 0;

        if (zeroForOne) {
            (, int256 amount1) = IUniswapV3Pool(poolAddress).swap(
                recipient,
                zeroForOne,
                SafeCast.toInt256(amount),
                _MIN_SQRT_RATIO,
                abi.encode(sender)
            );
            return SafeCast.toUint256(-amount1);
        } else {
            (int256 amount0, ) = IUniswapV3Pool(poolAddress).swap(
                recipient,
                zeroForOne,
                SafeCast.toInt256(amount),
                _MAX_SQRT_RATIO,
                abi.encode(sender)
            );

            return SafeCast.toUint256(-amount0);
        }
    }

    function _swapOfMultiswap(
        address recipient,
        address sender,
        MultiSwap calldata swap,
        uint256 amount
    ) private returns (uint256) {
        uint8 swapPlatform = uint8(swap.pool >> SWAP_PLATFORM);
        uint8 versionOfSwap = uint8(swap.pool >> VERSION_OF_SWAP);

        // Swap on Uniswap V3
        if (swapPlatform == UNISWAP_PLATFORM && versionOfSwap == VERSION_3) {
            uint256 returnValue = _swapV3(recipient, sender, swap.pool, amount);
            require(returnValue >= swap.minReturn, "Return amount is less than minReturn");
            return returnValue;
        } else if (
            // Swap on Uniswap V2 or V2 forks
            swapPlatform == SUSHISWAP_PLATFORM || (swapPlatform == UNISWAP_PLATFORM && versionOfSwap == VERSION_2)
        ) {
            // TODO: Implement V2 Swap
            return 0;
        } else {
            revert("Swap platform is not supported");
        }
    }

    function _permitERC20(uint256 amount, IERC20PermitSignature calldata erc20permit) private {
        ERC20Permit(erc20permit.token).permit(
            msg.sender,
            address(this),
            amount,
            erc20permit.deadline,
            erc20permit.v,
            erc20permit.r,
            erc20permit.s
        );
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external returns (bool) {
        address token;
        uint256 amount;
        if (amount0Delta > 0) {
            token = IUniswapV3Pool(msg.sender).token0();
            amount = SafeCast.toUint256(amount0Delta);
        } else {
            token = IUniswapV3Pool(msg.sender).token1();
            amount = SafeCast.toUint256(amount1Delta);
        }
        // Transfer from address in data to msg.sender
        address from = abi.decode(data, (address));
        bool success = IERC20(token).transferFrom(from, msg.sender, amount);

        return success;
    }
}
