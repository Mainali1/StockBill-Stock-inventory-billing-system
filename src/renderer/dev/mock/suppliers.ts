import type { MockModule } from "../mockApi";

const suppliersMock: MockModule = {
  "suppliers:listActive": () => {
    return [
      { id: 1, name: "Koshi Wholesale" },
      { id: 2, name: "Everest Oil Depot" },
      { id: 3, name: "Himal Traders" },
      { id: 4, name: "Sagarmatha Stationers" },
      { id: 5, name: "Mechi Household Supplies" },
    ];
  },
};

export default suppliersMock;
