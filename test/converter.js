const Converter = artifacts.require("Converter");

contract('converter', function(accounts) {
  it("should convert take tokens to give and back", async () => {
    const totalGive = "195738239776775570"
    const totalTake = "59744193591648150"
    const takeAmount = '50000000000000000'

    converter = await Converter.new()
    const calculatedGiveAmount = await converter.calculateGiveAmount(takeAmount, totalGive, totalTake)
    const calculatedTakeAmount = await converter.calculateTakeAmount(calculatedGiveAmount, totalGive, totalTake)

    console.log(calculatedGiveAmount.toString())
    console.log(calculatedTakeAmount.toString())
  });
});
