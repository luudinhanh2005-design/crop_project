from utils.dataset import prepare_dataset

if __name__ == "__main__":
    print("Starting ultra-expansion dataset preparation...")
    # overwrite=True để đảm bảo chia lại toàn bộ theo tỷ lệ mới
    prepare_dataset(overwrite=True)
    print("Success: 10,000 image preparation complete!")
