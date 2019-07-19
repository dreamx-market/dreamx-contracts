pragma solidity ^0.4.22;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Converter {
  using SafeMath for uint;

  constructor() public {
  }

  function calculateTakeAmount(uint _giveAmount, uint _totalGive, uint _totalTake) public pure returns (uint) {
    uint takeAmount = _totalTake.mul(_giveAmount).div(_totalGive);
    return takeAmount;
  }

  function calculateGiveAmount(uint _takeAmount, uint _totalGive, uint _totalTake) public pure returns (uint) {
    uint giveAmount = _totalGive.mul(_takeAmount).div(_totalTake);
    return giveAmount;
  }
}
